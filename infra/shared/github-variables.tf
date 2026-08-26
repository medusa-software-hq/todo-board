# What CI needs that is the same for every environment: where to push images, and who to be.
#
# Repository-level rather than per-environment, because these do not differ per environment — one
# registry, one identity. An environment-scoped copy would be three places for one fact.
#
# `GCP_CICD_WI_PROVIDER_NAME` is not among them: the Workload Identity provider belongs to the
# organization, and is published once there. A copy here would shadow it, so the day it is rotated
# every repository would pick that up except the ones that had published their own.

data "github_repository" "this" {
  full_name = "${module.config.gh_organization_name}/${module.config.project_name}"
}

resource "github_actions_variable" "gcp_cicd_sa_email" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_CICD_SA_EMAIL"
  value         = google_service_account.cicd.email
}

resource "github_actions_variable" "gcp_ar_repo_endpoint" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_AR_REPO_ENDPOINT"
  value         = google_artifact_registry_repository.primary.registry_uri
}

# The host on its own, for `gcloud auth configure-docker`, which takes a registry rather than a
# repository.
resource "github_actions_variable" "gcp_ar_repo_hostname" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_AR_REPO_HOSTNAME"
  value         = "${module.config.gcp_primary_location}-docker.pkg.dev"
}

resource "github_actions_variable" "gcp_primary_location" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_PRIMARY_LOCATION"
  value         = module.config.gcp_primary_location
}

resource "github_actions_variable" "gcp_api_run_service_name" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_API_RUN_SERVICE_NAME"
  value         = module.config.gcp_api_run_service_name
}

resource "github_actions_variable" "gcp_web_run_service_name" {
  repository    = data.github_repository.this.name
  variable_name = "GCP_WEB_RUN_SERVICE_NAME"
  value         = module.config.gcp_web_run_service_name
}
