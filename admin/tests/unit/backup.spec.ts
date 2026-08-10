import { test } from '@japa/runner'
import { resolve } from 'node:path'
import {
  buildBackupFilename,
  createBackupManifest,
  isSafeArchiveEntry,
  isSafeBackupFilename,
  parseBackupManifest,
  resolveInside,
} from '../../app/utils/backup.js'

test.group('backup utilities', () => {
  test('creates deterministic, portable archive filenames', ({ assert }) => {
    const filename = buildBackupFilename(new Date('2026-08-09T20:30:45.123Z'), '12345678-aaaa')

    assert.equal(filename, 'nomad-backup-20260809T203045Z-12345678.tar.gz')
    assert.isTrue(isSafeBackupFilename(filename))
    assert.isFalse(isSafeBackupFilename('../nomad-backup-20260809T203045Z-12345678.tar.gz'))
  })

  test('rejects unsafe archive entries and keeps valid entries inside a root', ({ assert }) => {
    assert.isTrue(isSafeArchiveEntry('storage/zim/example.zim'))
    assert.isFalse(isSafeArchiveEntry('../outside.txt'))
    assert.isFalse(isSafeArchiveEntry('/etc/passwd'))
    assert.isFalse(isSafeArchiveEntry('C:/Windows/system.ini'))
    assert.isNull(resolveInside('/backups/stage', '../outside.txt'))
    assert.equal(
      resolveInside('/backups/stage', 'storage/maps/index.pmtiles'),
      resolve('/backups/stage', 'storage/maps/index.pmtiles')
    )
  })

  test('round-trips and validates the backup manifest', ({ assert }) => {
    const manifest = createBackupManifest({
      createdAt: new Date('2026-08-09T20:30:45.000Z'),
      appVersion: '1.2.3',
      storageEntry: 'storage',
      databaseEntry: 'metadata/database.sql',
    })

    assert.deepEqual(parseBackupManifest(manifest), manifest)
    assert.throws(() => parseBackupManifest({ ...manifest, storage_entry: '../storage' }))
    assert.throws(() => parseBackupManifest({ ...manifest, format_version: 99 }))
  })
})
