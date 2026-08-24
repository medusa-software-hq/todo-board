terraform {
  required_version = ">= 1.15"
}

locals {
  # Organization's Internet domain
  organization_domain = "medusa.software"

  # Organization's GitHub organization name
  gh_organization_name = "medusa-software-hq"

  # Project's name/variant
  project_name    = "todo-board"
  project_variant = "v1"
}

output "organization_domain" {
  value = local.organization_domain
}

output "gh_organization_name" {
  value = local.gh_organization_name
}

output "project_name" {
  value = local.project_name
}

output "project_variant" {
  value = local.project_variant
}
