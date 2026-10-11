include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${get_repo_root()}/infrastructure//modules/ecr"
}

# Shared image repos — environments are tag namespaces (dev-*, prod-*) inside
# the same repos, not separate repos per env. Promotion copies manifests
# between tags, never rebuilds.
inputs = {
  environment = "shared"
}
