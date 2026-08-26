# The identity GitHub Actions deploys as — one, for every environment.
#
# No key is ever created: Actions federates into this account through the organization's Workload
# Identity pool, so what authorises a deploy is which repository the workflow ran in. Which
# environment it may then touch is decided by the grants the main stack makes, not by a second
# credential.

resource "google_service_account" "cicd" {
  project      = local.gcp_project_id
  account_id   = "github-actions"
  display_name = "CI/CD Service Account"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

resource "google_service_account_iam_member" "cicd_workload_identity_user" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${data.terraform_remote_state.meta.outputs.gcp_cicd_wi_pool_name}/attribute.repository/${module.config.gh_organization_name}/${module.config.project_name}"
}

# Push images.
resource "google_artifact_registry_repository_iam_member" "cicd_writer" {
  project    = google_artifact_registry_repository.primary.project
  location   = google_artifact_registry_repository.primary.location
  repository = google_artifact_registry_repository.primary.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.cicd.email}"
}

# Read every stack's state, and write this repository's own.
resource "google_storage_bucket_iam_member" "cicd_state_viewer" {
  bucket = module.config.gcp_terraform_state_bucket_name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_storage_bucket_iam_member" "cicd_state_admin" {
  bucket = module.config.gcp_terraform_state_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cicd.email}"

  condition {
    title       = "project_prefix_only"
    description = "Read/write only this project's own state."
    expression  = "resource.name.startsWith('projects/_/buckets/${module.config.gcp_terraform_state_bucket_name}/objects/${module.config.gcp_state_prefix_project}/')"
  }
}

# Outputs

output "gcp_cicd_service_account_email" {
  description = "The service account GitHub Actions federates into."
  value       = google_service_account.cicd.email
}
