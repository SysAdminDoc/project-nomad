#!/bin/bash

NOMAD_DIR="/opt/project-nomad"
COMPOSE_FILE="${NOMAD_DIR}/compose.yml"

resolve_runtime() {
    local configured_runtime="${NOMAD_CONTAINER_RUNTIME:-}"
    if [ -z "$configured_runtime" ] && [ -f "$COMPOSE_FILE" ]; then
        configured_runtime=$(grep -E 'NOMAD_CONTAINER_RUNTIME=' "$COMPOSE_FILE" 2>/dev/null | sed -E 's/.*NOMAD_CONTAINER_RUNTIME=([^[:space:]}]+).*/\1/' | head -n1)
    fi
    if [ "$configured_runtime" = "podman" ]; then
        echo "podman"
    else
        echo "docker"
    fi
}

runtime=$(resolve_runtime)
if ! command -v "$runtime" &>/dev/null; then
    echo "The configured container runtime ($runtime) is not installed."
    exit 1
fi

echo "Finding running $runtime containers for Project N.O.M.A.D..."

containers=$("$runtime" ps --filter "name=^nomad_" --format "{{.Names}}")

if [ -z "$containers" ]; then
    echo "No running containers found for Project N.O.M.A.D."
    exit 0
fi

echo "Found the following running containers:"
echo "$containers"
echo ""

for container in $containers; do
    echo "Gracefully stopping container: $container"
    if "$runtime" stop "$container"; then
        echo "✓ Successfully stopped $container"
    else
        echo "✗ Failed to stop $container"
    fi
    echo ""
done

echo "Finished initiating graceful shutdown of all Project N.O.M.A.D containers."
