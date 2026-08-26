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

  # Where this project's regional resources live
  gcp_primary_location = "europe-west1"

  # Organization's central Terraform state bucket
  gcp_terraform_state_bucket_name = "ms-tfstate-c1984596bdabf023"

  # The organization's meta project. Providers that create this project's own project cannot be
  # pointed at it — that is a cycle — so they bill their API calls here instead.
  gcp_meta_project_id = "ms-meta-9aaf29f0"

  # Cloud Run service names
  gcp_api_run_service_name = "api"
  gcp_web_run_service_name = "web"

  # Where each stack keeps its state, under the organization's bucket. Named here because stacks
  # read each other's, and a prefix spelled twice is a prefix that drifts. The backend blocks
  # themselves cannot interpolate, so they repeat these literally.
  # Everything this project keeps in the organization's bucket lives under one prefix, so the grant
  # that lets CI/CD write its own state can name that rather than each stack.
  gcp_state_prefix_project = "projects/todo-board/v1"

  # Root infra: high privilege, applied by hand. Minimal by design — it exists to solve the
  # chicken-and-egg problems, above all that the identity CI/CD runs as cannot be created by
  # something already running as it.
  gcp_state_prefix_shared = "projects/todo-board/v1/shared"
  gcp_state_prefix_main   = "projects/todo-board/v1/main"

  # Applied by CI, as the identity root infra created. Everything the product is actually made of
  # lives here.
  gcp_state_prefix_backend = "projects/todo-board/v1/backend"
  gcp_state_prefix_web_app = "projects/todo-board/v1/web-app"

  # The meta repository's own stack, which owns the organization's Workload Identity pool. Its name
  # is meta's to choose, not ours.
  gcp_state_prefix_meta_foundation = "shared/foundation"
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

output "gcp_primary_location" {
  value = local.gcp_primary_location
}

output "gcp_terraform_state_bucket_name" {
  value = local.gcp_terraform_state_bucket_name
}

output "gcp_meta_project_id" {
  value = local.gcp_meta_project_id
}

output "gcp_api_run_service_name" {
  value = local.gcp_api_run_service_name
}

output "gcp_web_run_service_name" {
  value = local.gcp_web_run_service_name
}

output "gcp_state_prefix_project" {
  value = local.gcp_state_prefix_project
}

output "gcp_state_prefix_shared" {
  value = local.gcp_state_prefix_shared
}

output "gcp_state_prefix_main" {
  value = local.gcp_state_prefix_main
}

output "gcp_state_prefix_backend" {
  value = local.gcp_state_prefix_backend
}

output "gcp_state_prefix_web_app" {
  value = local.gcp_state_prefix_web_app
}

output "gcp_state_prefix_meta_foundation" {
  value = local.gcp_state_prefix_meta_foundation
}
