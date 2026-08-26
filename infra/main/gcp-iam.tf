# What crosses the boundary between this environment and the shared project.
#
# Two things only, in opposite directions: CI/CD may deploy here, and this project may pull the
# images it deploys. Everything else stays inside one project or the other.

locals {
  cicd_service_account_email = data.terraform_remote_state.shared.outputs.gcp_cicd_service_account_email

  # Cloud Run pulls images as this project's own service agent, not as whoever deployed. A shared
  # registry therefore has to admit each environment's agent by name — the reason a per-environment
  # registry needs no IAM at all, and the price of being able to promote the identical image.
  run_service_agent_email = "service-${google_project.this.number}@serverless-robot-prod.iam.gserviceaccount.com"
}

# Create and deploy Cloud Run services here — `backend/infra` and `web-app/infra` are applied as
# this account.
resource "google_project_iam_member" "cicd_run_admin" {
  project = local.gcp_project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${local.cicd_service_account_email}"
}

# A Cloud Run deploy sets the service's identity, which means acting as it.
resource "google_project_iam_member" "cicd_service_account_user" {
  project = local.gcp_project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${local.cicd_service_account_email}"
}

# Each service runs as its own account, and the stack that declares the service is the one that
# creates it.
resource "google_project_iam_member" "cicd_service_account_admin" {
  project = local.gcp_project_id
  role    = "roles/iam.serviceAccountAdmin"
  member  = "serviceAccount:${local.cicd_service_account_email}"
}

# Pull images from the shared registry.
resource "google_artifact_registry_repository_iam_member" "run_agent_reader" {
  project    = data.terraform_remote_state.shared.outputs.gcp_ar_repo_project_id
  location   = data.terraform_remote_state.shared.outputs.gcp_ar_repo_location
  repository = data.terraform_remote_state.shared.outputs.gcp_ar_repo_name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${local.run_service_agent_email}"

  # The agent does not exist until the Cloud Run API is enabled here.
  depends_on = [google_project_service.apis["run.googleapis.com"]]
}
