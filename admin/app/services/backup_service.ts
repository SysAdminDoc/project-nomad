import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { inject } from '@adonisjs/core'
import Docker from 'dockerode'
import { createReadStream, createWriteStream } from 'node:fs'
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { PassThrough } from 'node:stream'
import { create, extract, list } from 'tar'
import {
  type BackupArchiveInfo,
  type BackupOperationResult,
  type BackupStatus,
  type BackupTarget,
} from '../../types/backup.js'
import {
  buildBackupFilename,
  createBackupManifest,
  isSafeArchiveEntry,
  isSafeBackupFilename,
  parseBackupManifest,
  resolveInside,
} from '../utils/backup.js'

const execFileAsync = promisify(execFile)
const BACKUP_ROOT_DEFAULT = '/backups'
const MYSQL_CONTAINER_NAME = 'nomad_mysql'
const DATABASE_DUMP_TIMEOUT_MS = 10 * 60 * 1000
const RCLONE_TIMEOUT_MS = 30 * 1000

type ArchiveEntry = {
  path: string
  type: string
}

@inject()
export class BackupService {
  private docker: Docker
  private activeOperation: Promise<unknown> | null = null

  constructor() {
    this.docker = new Docker(
      process.platform === 'win32'
        ? { socketPath: '//./pipe/docker_engine' }
        : { socketPath: '/var/run/docker.sock' }
    )
  }

  async getStatus(): Promise<BackupStatus> {
    const backupRoot = this.getBackupRoot()
    const local = {
      path: backupRoot,
      writable: false,
      archives: [] as BackupArchiveInfo[],
      error: undefined as string | undefined,
    }

    try {
      await mkdir(backupRoot, { recursive: true })
      await access(backupRoot, fsConstants.W_OK)
      local.writable = true
      local.archives = await this.listLocalArchives(backupRoot)
    } catch (error) {
      local.error = this.safeErrorMessage(error, 'The local backup destination is unavailable')
    }

    const remoteName = this.getRcloneRemote()
    const rclone = {
      configured: Boolean(remoteName),
      available: false,
      remote: remoteName,
      archives: [] as BackupArchiveInfo[],
      error: undefined as string | undefined,
    }

    if (remoteName) {
      if (!this.isValidRcloneRemote(remoteName)) {
        rclone.error = 'NOMAD_RCLONE_REMOTE must use the form remote:path'
      } else if (!(await this.isRcloneAvailable())) {
        rclone.error = 'rclone is not installed in the admin container'
      } else {
        rclone.available = true
        try {
          rclone.archives = await this.listRcloneArchives(remoteName)
        } catch (error) {
          rclone.error = this.safeErrorMessage(error, 'The rclone remote could not be listed')
        }
      }
    }

    return { local, rclone }
  }

  async createBackup(target: BackupTarget): Promise<BackupOperationResult> {
    return this.runExclusive(async () => {
      if (target !== 'local' && target !== 'rclone') {
        return { success: false, message: 'Unknown backup destination', target }
      }

      const remoteName = this.getRcloneRemote()
      if (target === 'rclone') {
        if (!remoteName || !this.isValidRcloneRemote(remoteName)) {
          return {
            success: false,
            message: 'Configure NOMAD_RCLONE_REMOTE as remote:path before using rclone backups.',
            target,
          }
        }
        if (!(await this.isRcloneAvailable())) {
          return {
            success: false,
            message: 'rclone is not installed in the admin container.',
            target,
          }
        }
      }

      const backupRoot = this.getBackupRoot()
      const storageRoot = this.getStorageRoot()
      await mkdir(backupRoot, { recursive: true })
      await this.assertBackupRootsAreSeparate(storageRoot, backupRoot)
      await this.assertDirectory(storageRoot, 'The Nomad storage directory is unavailable')

      const filename = buildBackupFilename()
      const destination = join(backupRoot, filename)
      const partialDestination = join(backupRoot, `.${filename}.${randomUUID()}.partial`)
      const metadataDirectory = await mkdtemp(join(dirname(storageRoot), '.nomad-backup-'))
      const metadataName = basename(metadataDirectory)
      const databaseEntry = `${metadataName}/database.sql`
      const databasePath = join(metadataDirectory, 'database.sql')
      const manifestPath = join(metadataDirectory, 'manifest.json')

      try {
        await this.dumpDatabase(databasePath)
        const manifest = createBackupManifest({
          createdAt: new Date(),
          appVersion: await this.getAppVersion(),
          storageEntry: basename(storageRoot),
          databaseEntry,
        })
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

        await create(
          {
            cwd: dirname(storageRoot),
            file: partialDestination,
            gzip: true,
            portable: true,
            strict: true,
            follow: false,
            filter: (_entryPath, entry) => {
              const candidate = entry as { isSymbolicLink?: () => boolean }
              if (candidate.isSymbolicLink?.()) {
                throw new Error('Storage contains a symbolic link that cannot be backed up safely')
              }
              return true
            },
          },
          [basename(storageRoot), metadataName]
        )
        await chmod(partialDestination, 0o600)
        await rename(partialDestination, destination)

        if (target === 'rclone') {
          await this.uploadToRclone(destination, remoteName!)
        }

        return {
          success: true,
          message:
            target === 'rclone'
              ? `Backup created and uploaded to ${remoteName}.`
              : 'Backup created on the local destination.',
          filename,
          target,
        }
      } catch (error) {
        await rm(partialDestination, { force: true }).catch(() => undefined)
        const message = this.safeErrorMessage(error, 'Backup creation failed')
        logger.error(`[BackupService] ${message}`)
        return { success: false, message, target, filename }
      } finally {
        await rm(metadataDirectory, { recursive: true, force: true }).catch(() => undefined)
      }
    })
  }

  async restoreBackup(
    target: BackupTarget,
    filename: string,
    confirmation: string
  ): Promise<BackupOperationResult> {
    return this.runExclusive(async () => {
      if (confirmation !== 'RESTORE') {
        return {
          success: false,
          message: 'Type RESTORE to confirm replacing the current Nomad data.',
          target,
          filename,
        }
      }
      if (!isSafeBackupFilename(filename)) {
        return { success: false, message: 'Invalid backup filename.', target, filename }
      }

      const temporaryDirectory = await mkdtemp(join(this.getTemporaryRoot(), '.nomad-restore-'))
      const archivePath = join(temporaryDirectory, filename)

      try {
        if (target === 'local') {
          const localPath = resolveInside(this.getBackupRoot(), filename)
          if (!localPath || !(await this.isRegularFile(localPath))) {
            return { success: false, message: 'Local backup file was not found.', target, filename }
          }
          await this.copyFile(localPath, archivePath)
        } else {
          const remoteName = this.getRcloneRemote()
          if (!remoteName || !this.isValidRcloneRemote(remoteName)) {
            return {
              success: false,
              message: 'Configure NOMAD_RCLONE_REMOTE as remote:path before restoring.',
              target,
              filename,
            }
          }
          if (!(await this.isRcloneAvailable())) {
            return {
              success: false,
              message: 'rclone is not installed in the admin container.',
              target,
              filename,
            }
          }
          await this.downloadFromRclone(remoteName, filename, archivePath)
        }

        await this.restoreArchive(archivePath)
        return {
          success: true,
          message: 'Backup restored. Services may take a moment to reflect restored data.',
          target,
          filename,
        }
      } catch (error) {
        const message = this.safeErrorMessage(error, 'Restore failed')
        logger.error(`[BackupService] ${message}`)
        return { success: false, message, target, filename }
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => undefined)
      }
    })
  }

  private async restoreArchive(archivePath: string): Promise<void> {
    const entries = await this.listArchiveEntries(archivePath)
    const unsafeEntry = entries.find(
      (entry) => !isSafeArchiveEntry(entry.path) || !this.isSafeArchiveType(entry.type)
    )
    if (unsafeEntry) {
      throw new Error(`Backup contains an unsafe archive entry: ${unsafeEntry.path}`)
    }

    const manifestEntries = entries.filter((entry) => {
      const parts = entry.path.split('/')
      return basename(entry.path) === 'manifest.json' && /^\.nomad-backup-/.test(parts.at(-2) || '')
    })
    if (manifestEntries.length !== 1) {
      throw new Error('Backup must contain exactly one manifest.json file')
    }

    await mkdir(dirname(this.getStorageRoot()), { recursive: true })
    const restoreStage = await mkdtemp(join(dirname(this.getStorageRoot()), '.nomad-restore-'))
    let rollbackDatabasePath: string | null = null
    let oldStoragePath: string | null = null
    let storageInstalled = false

    try {
      await extract({
        cwd: restoreStage,
        file: archivePath,
        gzip: true,
        preserveOwner: false,
        preservePaths: false,
        strict: true,
        unlink: false,
        filter: (entryPath, entry) => {
          if (
            !isSafeArchiveEntry(entryPath) ||
            !this.isSafeArchiveType((entry as { type?: string }).type || '')
          ) {
            throw new Error(`Backup contains an unsafe archive entry: ${entryPath}`)
          }
          return true
        },
      })

      const manifestPath = join(restoreStage, manifestEntries[0].path)
      const manifest = parseBackupManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
      const storageStage = resolveInside(restoreStage, manifest.storage_entry)
      const databasePath = resolveInside(restoreStage, manifest.database_entry)
      if (!storageStage || !databasePath) {
        throw new Error('Backup manifest contains an unsafe data path')
      }
      if (!(await this.isDirectory(storageStage)) || !(await this.isRegularFile(databasePath))) {
        throw new Error('Backup is missing its storage directory or database dump')
      }

      rollbackDatabasePath = join(restoreStage, 'rollback-database.sql')
      await this.dumpDatabase(rollbackDatabasePath)

      const storageRoot = this.getStorageRoot()
      oldStoragePath = `${storageRoot}.restore-old-${randomUUID()}`
      if (await this.pathExists(storageRoot)) {
        await rename(storageRoot, oldStoragePath)
      }
      await rename(storageStage, storageRoot)
      storageInstalled = true

      try {
        await this.importDatabase(databasePath)
      } catch (error) {
        logger.error(`[BackupService] Restored database import failed; attempting rollback`)
        try {
          await this.importDatabase(rollbackDatabasePath)
        } catch (rollbackError) {
          logger.error(
            `[BackupService] Database rollback failed: ${this.safeErrorMessage(rollbackError, 'unknown error')}`
          )
        }
        throw error
      }

      if (oldStoragePath) {
        await rm(oldStoragePath, { recursive: true, force: true })
        oldStoragePath = null
      }
    } catch (error) {
      if (storageInstalled) {
        await rm(this.getStorageRoot(), { recursive: true, force: true }).catch(() => undefined)
      }
      if (oldStoragePath) {
        await rename(oldStoragePath, this.getStorageRoot()).catch(() => undefined)
      }
      throw error
    } finally {
      await rm(restoreStage, { recursive: true, force: true }).catch(() => undefined)
      if (rollbackDatabasePath) {
        await rm(rollbackDatabasePath, { force: true }).catch(() => undefined)
      }
    }
  }

  private async listArchiveEntries(archivePath: string): Promise<ArchiveEntry[]> {
    const entries: ArchiveEntry[] = []
    await list({
      file: archivePath,
      gzip: true,
      strict: true,
      onReadEntry: (entry) => {
        entries.push({ path: entry.path, type: entry.type })
      },
    })
    return entries
  }

  private async dumpDatabase(destination: string): Promise<void> {
    let containerAvailable = false
    try {
      const container = this.docker.getContainer(MYSQL_CONTAINER_NAME)
      const info = await container.inspect()
      containerAvailable = true
      if (!info.State?.Running) {
        throw new Error('MySQL container is not running')
      }
      await this.dumpDatabaseFromContainer(container, destination)
      return
    } catch (error) {
      if (containerAvailable) throw error
      logger.warn('[BackupService] MySQL container unavailable; trying a local mysqldump client')
    }

    await this.runLocalDatabaseCommand('mysqldump', this.databaseDumpArguments(), destination)
  }

  private async importDatabase(source: string): Promise<void> {
    let containerAvailable = false
    try {
      const container = this.docker.getContainer(MYSQL_CONTAINER_NAME)
      const info = await container.inspect()
      containerAvailable = true
      if (!info.State?.Running) {
        throw new Error('MySQL container is not running')
      }
      await this.importDatabaseIntoContainer(container, source)
      return
    } catch (error) {
      if (containerAvailable) throw error
      logger.warn('[BackupService] MySQL container unavailable; trying a local mysql client')
    }

    await this.runLocalDatabaseCommand('mysql', this.databaseImportArguments(), source)
  }

  private databaseConnectionArguments(): string[] {
    const password = env.get('DB_PASSWORD')
    return [
      '--protocol=TCP',
      '--host',
      env.get('DB_HOST'),
      '--port',
      String(env.get('DB_PORT')),
      '--user',
      env.get('DB_USER'),
      ...(password ? [`--password=${password}`] : []),
    ]
  }

  private databaseDumpArguments(): string[] {
    return [
      ...this.databaseConnectionArguments(),
      '--single-transaction',
      '--routines',
      '--events',
      '--hex-blob',
      '--no-tablespaces',
      '--set-gtid-purged=OFF',
      env.get('DB_DATABASE'),
    ]
  }

  private databaseImportArguments(): string[] {
    return [...this.databaseConnectionArguments(), env.get('DB_DATABASE')]
  }

  private async dumpDatabaseFromContainer(container: any, destination: string): Promise<void> {
    await this.runContainerCommand(
      container,
      [
        'mysqldump',
        '--single-transaction',
        '--routines',
        '--events',
        '--hex-blob',
        '--no-tablespaces',
        '--set-gtid-purged=OFF',
        '--user',
        env.get('DB_USER'),
        ...(env.get('DB_PASSWORD') ? [`--password=${env.get('DB_PASSWORD')}`] : []),
        env.get('DB_DATABASE'),
      ],
      { outputPath: destination }
    )
  }

  private async importDatabaseIntoContainer(container: any, source: string): Promise<void> {
    await this.runContainerCommand(
      container,
      [
        'mysql',
        '--user',
        env.get('DB_USER'),
        ...(env.get('DB_PASSWORD') ? [`--password=${env.get('DB_PASSWORD')}`] : []),
        env.get('DB_DATABASE'),
      ],
      { inputPath: source }
    )
  }

  private async runContainerCommand(
    container: any,
    command: string[],
    options: { outputPath?: string; inputPath?: string }
  ): Promise<void> {
    const output = new PassThrough()
    const errorOutput = new PassThrough()
    const stderr: Buffer[] = []
    errorOutput.on('data', (chunk: Buffer) => stderr.push(chunk))

    const exec = await container.exec({
      Cmd: command,
      AttachStdin: Boolean(options.inputPath),
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    })
    const stream = await exec.start({ hijack: true, stdin: Boolean(options.inputPath) })
    container.modem.demuxStream(stream, output, errorOutput)

    const outputFile = options.outputPath ? createWriteStream(options.outputPath) : null
    if (outputFile) output.pipe(outputFile)
    else output.resume()

    const streamFinished = new Promise<void>((resolvePromise, rejectPromise) => {
      let finished = false
      const finish = (error?: Error) => {
        if (finished) return
        finished = true
        if (error) {
          output.destroy()
          errorOutput.destroy()
          rejectPromise(error)
          return
        }
        output.end()
        errorOutput.end()
        if (outputFile) {
          outputFile.once('error', rejectPromise)
          outputFile.once('finish', () => resolvePromise())
        } else {
          resolvePromise()
        }
      }
      stream.once('error', finish)
      stream.once('end', () => finish())
      stream.once('close', () => finish())
    })

    let inputFinished: Promise<void> = Promise.resolve()
    if (options.inputPath) {
      const input = createReadStream(options.inputPath)
      inputFinished = new Promise<void>((resolvePromise, rejectPromise) => {
        input.once('error', rejectPromise)
        stream.once('error', rejectPromise)
        input.once('end', () => resolvePromise())
        input.pipe(stream)
      })
    }

    await Promise.all([streamFinished, inputFinished])
    const inspection = await this.waitForExecExit(exec)
    if (inspection.ExitCode !== 0) {
      const detail = Buffer.concat(stderr).toString('utf8').trim()
      throw new Error(detail || `MySQL command failed with exit code ${inspection.ExitCode}`)
    }
  }

  private async runLocalDatabaseCommand(
    command: 'mysqldump' | 'mysql',
    args: string[],
    filePath: string
  ): Promise<void> {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const outputFile = command === 'mysqldump' ? createWriteStream(filePath) : null
    if (outputFile) child.stdout?.pipe(outputFile)
    else createReadStream(filePath).pipe(child.stdin!)
    const stderr: Buffer[] = []
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk))

    const timeout = setTimeout(() => child.kill(), DATABASE_DUMP_TIMEOUT_MS)
    try {
      const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
        child.once('error', rejectPromise)
        child.once('close', (code) => resolvePromise(code ?? 1))
      })
      if (exitCode !== 0) {
        const detail = Buffer.concat(stderr).toString('utf8').trim()
        throw new Error(detail || `${command} failed with exit code ${exitCode}`)
      }
      if (outputFile) {
        await new Promise<void>((resolvePromise, rejectPromise) => {
          outputFile?.once('error', rejectPromise)
          outputFile?.once('finish', () => resolvePromise())
        })
      }
    } catch (error) {
      outputFile?.destroy()
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async waitForExecExit(exec: any): Promise<{ ExitCode: number | null }> {
    const deadline = Date.now() + DATABASE_DUMP_TIMEOUT_MS
    while (Date.now() < deadline) {
      const inspection = await exec.inspect()
      if (!inspection.Running && inspection.ExitCode !== null) return inspection
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
    }
    throw new Error('MySQL operation timed out')
  }

  private async uploadToRclone(localPath: string, remoteName: string): Promise<void> {
    await this.runRclone([
      'copyto',
      localPath,
      this.remoteFilePath(remoteName, basename(localPath)),
    ])
  }

  private async downloadFromRclone(
    remoteName: string,
    filename: string,
    destination: string
  ): Promise<void> {
    await this.runRclone(['copyto', this.remoteFilePath(remoteName, filename), destination])
  }

  private async listRcloneArchives(remoteName: string): Promise<BackupArchiveInfo[]> {
    const result = await this.runRclone([
      'lsf',
      '--files-only',
      '--include',
      'nomad-backup-*.tar.gz',
      this.remotePath(remoteName),
    ])
    return result.stdout
      .split(/\r?\n/)
      .map((filename) => filename.trim())
      .filter((filename) => isSafeBackupFilename(filename))
      .map((filename) => ({
        filename,
        size_bytes: 0,
        created_at: '',
        target: 'rclone' as const,
      }))
  }

  private async runRclone(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const result = await execFileAsync('rclone', args, {
      timeout: RCLONE_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      env: process.env,
    })
    return { stdout: result.stdout, stderr: result.stderr }
  }

  private async isRcloneAvailable(): Promise<boolean> {
    try {
      await this.runRclone(['version'])
      return true
    } catch {
      return false
    }
  }

  private async listLocalArchives(root: string): Promise<BackupArchiveInfo[]> {
    const entries = await readdir(root, { withFileTypes: true })
    const archives = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isSafeBackupFilename(entry.name))
        .map(async (entry) => {
          const details = await stat(join(root, entry.name))
          return {
            filename: entry.name,
            size_bytes: details.size,
            created_at: details.mtime.toISOString(),
            target: 'local' as const,
          }
        })
    )
    return archives.sort((left, right) => right.created_at.localeCompare(left.created_at))
  }

  private async assertBackupRootsAreSeparate(storageRoot: string, backupRoot: string) {
    const storage = resolve(storageRoot)
    const backup = resolve(backupRoot)
    const contains = (parent: string, child: string) =>
      child === parent || child.startsWith(`${parent}${sep}`)
    if (contains(storage, backup) || contains(backup, storage)) {
      throw new Error('Backup destination must be separate from the Nomad storage directory')
    }
  }

  private async assertDirectory(path: string, message: string): Promise<void> {
    try {
      const details = await stat(path)
      if (!details.isDirectory()) throw new Error(message)
    } catch {
      throw new Error(message)
    }
  }

  private async isDirectory(path: string): Promise<boolean> {
    try {
      const details = await lstat(path)
      return details.isDirectory()
    } catch {
      return false
    }
  }

  private async isRegularFile(path: string): Promise<boolean> {
    try {
      const details = await lstat(path)
      return details.isFile()
    } catch {
      return false
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await lstat(path)
      return true
    } catch {
      return false
    }
  }

  private async copyFile(source: string, destination: string): Promise<void> {
    const input = createReadStream(source)
    const output = createWriteStream(destination, { mode: 0o600 })
    await new Promise<void>((resolvePromise, rejectPromise) => {
      input.once('error', rejectPromise)
      output.once('error', rejectPromise)
      output.once('close', () => resolvePromise())
      input.pipe(output)
    })
  }

  private async getAppVersion(): Promise<string> {
    try {
      const versionFile = JSON.parse(await readFile(join(process.cwd(), 'version.json'), 'utf8'))
      return typeof versionFile.version === 'string' ? versionFile.version : 'unknown'
    } catch {
      return process.env.npm_package_version || 'unknown'
    }
  }

  private getStorageRoot(): string {
    return resolve(process.env.NOMAD_STORAGE_PATH || join(process.cwd(), 'storage'))
  }

  private getBackupRoot(): string {
    return resolve(env.get('NOMAD_BACKUP_PATH') || BACKUP_ROOT_DEFAULT)
  }

  private getTemporaryRoot(): string {
    return resolve(process.env.TMPDIR || process.env.TEMP || process.cwd())
  }

  private getRcloneRemote(): string | null {
    const remote = env.get('NOMAD_RCLONE_REMOTE')?.trim()
    return remote || null
  }

  private isValidRcloneRemote(remote: string): boolean {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*:/.test(remote)) return false
    return ![...remote].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 0x1f || code === 0x7f
    })
  }

  private remotePath(remote: string): string {
    return remote.replace(/\/+$/, '')
  }

  private remoteFilePath(remote: string, filename: string): string {
    return `${this.remotePath(remote)}/${filename}`
  }

  private isSafeArchiveType(type: string): boolean {
    return ['File', 'Directory', 'OldFile', 'ContiguousFile'].includes(type)
  }

  private safeErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.activeOperation) {
      return {
        success: false,
        message: 'Another backup or restore operation is already running.',
      } as T
    }

    const promise = operation()
    this.activeOperation = promise
    try {
      return await promise
    } finally {
      if (this.activeOperation === promise) this.activeOperation = null
    }
  }
}
