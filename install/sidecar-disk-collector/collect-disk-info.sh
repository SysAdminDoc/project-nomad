#!/bin/bash

# Project N.O.M.A.D. - Disk Info Collector Sidecar
#
# Reads host block device and filesystem info via the /:/host:ro,rslave bind-mount.
# No special capabilities required. Writes JSON to /storage/nomad-disk-info.json, which is read by the admin container.
# Runs continually and updates the JSON data every 2 minutes.

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

log "disk-collector sidecar starting..."

# SMART data is best-effort. The collector can still report disk capacity when
# a host, USB bridge, or container runtime does not expose SMART attributes.
collect_smart_health() {
    local disk_name="$1"
    local device="/host/dev/${disk_name}"
    local smart_json
    local passed
    local status="unknown"
    local message="SMART data unavailable"

    if [[ ! -b "$device" && ! -c "$device" ]]; then
        jq -n --arg status "$status" --arg message "$message" '{status:$status,message:$message}'
        return
    fi

    smart_json=$(timeout 5 smartctl -a -j "$device" 2>/dev/null || true)
    if [[ -z "$smart_json" ]]; then
        jq -n --arg status "$status" --arg message "$message" '{status:$status,message:$message}'
        return
    fi

    passed=$(printf '%s' "$smart_json" | jq -r '.smart_status.passed // empty' 2>/dev/null || true)
    if [[ "$passed" == "true" ]]; then
        status="passed"
        message="SMART health passed"
    elif [[ "$passed" == "false" ]]; then
        status="failed"
        message="SMART health reported a failure"
    fi

    local result
    result=$(jq -n --arg status "$status" --arg message "$message" \
        '{status:$status,source:"smartctl",message:$message}')

    local temperature
    temperature=$(printf '%s' "$smart_json" | jq -r '(.temperature.current // .nvme_smart_health_information_log.temperature // empty)' 2>/dev/null || true)
    if [[ "$temperature" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
        result=$(printf '%s' "$result" | jq --argjson value "$temperature" '. + {temperatureC:$value}')
    fi

    local percentage_used
    percentage_used=$(printf '%s' "$smart_json" | jq -r '.nvme_smart_health_information_log.percentage_used // empty' 2>/dev/null || true)
    if [[ "$percentage_used" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
        result=$(printf '%s' "$result" | jq --argjson value "$percentage_used" '. + {percentageUsed:$value}')
    fi

    local media_errors
    media_errors=$(printf '%s' "$smart_json" | jq -r '.nvme_smart_health_information_log.media_errors // empty' 2>/dev/null || true)
    if [[ "$media_errors" =~ ^[0-9]+$ ]]; then
        result=$(printf '%s' "$result" | jq --argjson value "$media_errors" '. + {mediaErrors:$value}')
    fi

    printf '%s' "$result"
}

# Write a valid placeholder immediately so admin has something to parse if the
# file is missing (first install, user deleted it, etc.). The real data from the
# first full collection cycle below will overwrite this within seconds.
if [[ ! -f /storage/nomad-disk-info.json ]]; then
    echo '{"diskLayout":{"blockdevices":[]},"fsSize":[]}' > /storage/nomad-disk-info.json
    log "Created initial placeholder — will be replaced after first collection."
fi

while true; do

    # Get disk layout (-b outputs SIZE in bytes as a number rather than a human-readable string)
    DISK_LAYOUT=$(lsblk --sysroot /host --json -b -o NAME,SIZE,TYPE,MODEL,SERIAL,VENDOR,ROTA,TRAN 2>/dev/null)
    if [[ -z "$DISK_LAYOUT" ]]; then
        log "WARNING: lsblk --sysroot /host failed, using empty block devices"
        DISK_LAYOUT='{"blockdevices":[]}'
    fi

    # Attach a best-effort SMART result to each physical disk. The admin API
    # uses this to show a health signal during first boot without treating
    # missing SMART permissions as a drive failure.
    HEALTH_JSON='{}'
    while IFS= read -r DISK_NAME; do
        [[ -z "$DISK_NAME" ]] && continue
        HEALTH=$(collect_smart_health "$DISK_NAME")
        HEALTH_JSON=$(printf '%s' "$HEALTH_JSON" | jq --arg name "$DISK_NAME" --argjson health "$HEALTH" '. + {($name):$health}')
    done < <(printf '%s' "$DISK_LAYOUT" | jq -r '.blockdevices[] | select(.type == "disk") | .name')
    DISK_LAYOUT=$(printf '%s' "$DISK_LAYOUT" | jq --argjson health "$HEALTH_JSON" \
        '.blockdevices |= map(if $health[.name] then . + {health:$health[.name]} else . end)')

    # Get filesystem usage by parsing /host/proc/1/mounts (PID 1 = host init = root mount namespace)
    # /host/proc/mounts is a symlink to /proc/self/mounts, which always reflects the CURRENT
    # process's mount namespace (the container's), not the host's. /proc/1/mounts reflects the
    # host init process's namespace, giving us the true host mount table.
    FS_JSON="["
    FIRST=1
    while IFS=' ' read -r dev mountpoint fstype opts _rest; do
        # Disregard pseudo and virtual filesystems
        [[ "$fstype" =~ ^(tmpfs|devtmpfs|squashfs|sysfs|proc|devpts|cgroup|cgroup2|overlay|nsfs|autofs|hugetlbfs|mqueue|pstore|fusectl|binfmt_misc)$ ]] && continue
        [[ "$mountpoint" == "none" ]] && continue

        # Skip Docker bind-mounts to individual files (e.g., /etc/resolv.conf, /etc/hostname, /etc/hosts)
        # These are not real filesystem roots and report misleading sizes
        [[ -f "/host${mountpoint}" ]] && continue

        STATS=$(df -B1 "/host${mountpoint}" 2>/dev/null | awk 'NR==2{print $2,$3,$4,$5}')
        [[ -z "$STATS" ]] && continue

        read -r size used avail pct <<< "$STATS"
        pct="${pct/\%/}"

        [[ "$FIRST" -eq 0 ]] && FS_JSON+=","
        FS_JSON+="{\"fs\":\"${dev}\",\"size\":${size},\"used\":${used},\"available\":${avail},\"use\":${pct},\"mount\":\"${mountpoint}\"}"
        FIRST=0
    done < /host/proc/1/mounts

    # Fallback: if no real filesystems were found from the host mount table
    # (e.g. /host/proc/1/mounts was unreadable), try the /storage mount directly.
    # The disk-collector container always has /storage bind-mounted from the host,
    # so df on /storage reflects the actual backing device and its capacity.
    if [[ "$FIRST" -eq 1 ]] && mountpoint -q /storage 2>/dev/null; then
        STATS=$(df -B1 /storage 2>/dev/null | awk 'NR==2{print $1,$2,$3,$4,$5}')
        if [[ -n "$STATS" ]]; then
            read -r dev size used avail pct <<< "$STATS"
            pct="${pct/\%/}"
            FS_JSON+="{\"fs\":\"${dev}\",\"size\":${size},\"used\":${used},\"available\":${avail},\"use\":${pct},\"mount\":\"/storage\"}"
            FIRST=0
            log "Used /storage mount as fallback for filesystem info."
        fi
    fi

    FS_JSON+="]"

    # Use a tmp file for atomic update
    cat > /storage/nomad-disk-info.json.tmp << EOF
{
"diskLayout": ${DISK_LAYOUT},
"fsSize": ${FS_JSON}
}
EOF

    if mv /storage/nomad-disk-info.json.tmp /storage/nomad-disk-info.json; then
        log "Disk info updated successfully."
    else
        log "ERROR: Failed to move temp file to /storage/nomad-disk-info.json"
    fi

    sleep 120
done
