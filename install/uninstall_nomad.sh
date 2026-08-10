#!/bin/bash

# Project N.O.M.A.D. Uninstall Script

###################################################################################################################################################################################################

# Script                | Project N.O.M.A.D. Uninstall Script
# Version               | 1.0.0
# Author                | Crosstalk Solutions, LLC
# Website               | https://crosstalksolutions.com

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                  Constants & Variables                                                                                          #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

NOMAD_DIR="/opt/project-nomad"
MANAGEMENT_COMPOSE_FILE="${NOMAD_DIR}/compose.yml"

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                     Functions                                                                                                   #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################

check_has_sudo() {
  if sudo -n true 2>/dev/null; then
    echo -e "${GREEN}#${RESET} User has sudo permissions.\\n"
  else
    echo "User does not have sudo permissions"
    header_red
    echo -e "${RED}#${RESET} This script requires sudo permissions to run. Please run the script with sudo.\\n"
    echo -e "${RED}#${RESET} For example: sudo bash $(basename "$0")"
    exit 1
  fi
}

check_current_directory(){
  if [ "$(pwd)" == "${NOMAD_DIR}" ]; then
    echo "Please run this script from a directory other than ${NOMAD_DIR}."
    exit 1
  fi
}

ensure_management_compose_file_exists(){
  if [ ! -f "${MANAGEMENT_COMPOSE_FILE}" ]; then
    echo "Unable to find the management Docker Compose file at ${MANAGEMENT_COMPOSE_FILE}. There may be a problem with your Project N.O.M.A.D. installation."
    exit 1
  fi
}

get_uninstall_confirmation(){
  read -p "This script will remove ALL Project N.O.M.A.D. files and containers. THIS CANNOT BE UNDONE. Are you sure you want to continue? (y/n): " choice
  case "$choice" in
    y|Y )
      echo -e "User chose to continue with the uninstallation."
      ;;
    n|N )
      echo -e "User chose not to continue with the uninstallation."
      exit 0
      ;;
    * )
      echo "Invalid Response"
      echo "User chose not to continue with the uninstallation."
      exit 0
      ;;
  esac
}

resolve_runtime() {
  local configured_runtime="${NOMAD_CONTAINER_RUNTIME:-}"
  if [[ -z "$configured_runtime" && -f "$MANAGEMENT_COMPOSE_FILE" ]]; then
    configured_runtime=$(grep -E 'NOMAD_CONTAINER_RUNTIME=' "$MANAGEMENT_COMPOSE_FILE" 2>/dev/null | sed -E 's/.*NOMAD_CONTAINER_RUNTIME=([^[:space:]}]+).*/\1/' | head -n1)
  fi
  if [[ "$configured_runtime" == 'podman' ]]; then
    echo 'podman'
  else
    echo 'docker'
  fi
}

run_compose() {
  if [[ "$(resolve_runtime)" == 'podman' ]]; then
    if podman compose version &>/dev/null; then
      podman compose "$@"
    elif command -v podman-compose &>/dev/null; then
      podman-compose "$@"
    else
      echo "Podman Compose is not installed or not available."
      return 1
    fi
  else
    docker compose "$@"
  fi
}

ensure_container_runtime() {
    local runtime
    runtime=$(resolve_runtime)
    if ! command -v "$runtime" &> /dev/null; then
        echo "Unable to find the configured container runtime ($runtime). There may be a problem with your Project N.O.M.A.D. installation."
        exit 1
    fi
}

check_docker_compose() {
  if ! run_compose version &>/dev/null; then
    echo -e "${RED}#${RESET} Compose is not installed or not available for the configured container runtime."
    echo -e "${YELLOW}#${RESET} Install Docker Compose v2 or the Podman Compose provider, then try again."
    exit 1
  fi
}

storage_cleanup() {
  read -p "Do you want to delete the Project N.O.M.A.D. storage directory (${NOMAD_DIR})? This is best if you want to start a completely fresh install. This will PERMANENTLY DELETE all stored Nomad data and can't be undone! (y/N): " delete_dir_choice
  case "$delete_dir_choice" in
      y|Y )
          echo "Removing Project N.O.M.A.D. files..."
          if rm -rf "${NOMAD_DIR}"; then
              echo "Project N.O.M.A.D. files removed."
          else
              echo "Warning: Failed to fully remove ${NOMAD_DIR}. You may need to remove it manually."
          fi
          ;;
      * )
          echo "Skipping removal of ${NOMAD_DIR}."
          ;;
  esac
}

uninstall_nomad() {
    local runtime
    runtime=$(resolve_runtime)
    echo "Stopping and removing Project N.O.M.A.D. management containers..."
    run_compose -p project-nomad -f "${MANAGEMENT_COMPOSE_FILE}" down
    echo "Allowing some time for management containers to stop..."
    sleep 5


    # Stop and remove all containers where name starts with "nomad_"
    echo "Stopping and removing all Project N.O.M.A.D. app containers..."
    local containers
    containers=$("$runtime" ps -a --filter "name=^nomad_" --format "{{.Names}}")
    while IFS= read -r container; do
        if [[ -n "$container" ]]; then
            "$runtime" rm -f "$container"
        fi
    done <<< "$containers"
    echo "Allowing some time for app containers to stop..."
    sleep 5

    echo "Containers should be stopped now."

    # Remove the shared container network (may still exist if app containers were using it during compose down)
    echo "Removing project-nomad_default network if it exists..."
    "$runtime" network rm project-nomad_default 2>/dev/null && echo "Network removed." || echo "Network already removed or not found."

    # Remove the shared update volume
    echo "Removing project-nomad_nomad-update-shared volume if it exists..."
    "$runtime" volume rm project-nomad_nomad-update-shared 2>/dev/null && echo "Volume removed." || echo "Volume already removed or not found."

    # Prompt user for storage cleanup and handle it if so
    storage_cleanup

    echo "Project N.O.M.A.D. has been uninstalled. We hope to see you again soon!"
}

###################################################################################################################################################################################################
#                                                                                                                                                                                                 #
#                                                                                       Main                                                                                                      #
#                                                                                                                                                                                                 #
###################################################################################################################################################################################################
check_has_sudo
check_current_directory
ensure_management_compose_file_exists
ensure_container_runtime
check_docker_compose
get_uninstall_confirmation
uninstall_nomad
