# The Docker repository CI/CD pushes to, and every environment pulls from.
#
# One repository rather than one per environment: promoting to production means deploying the image
# staging already ran, and an image copied between registries is a different artifact by the time
# anyone has to prove which one is live.

resource "google_artifact_registry_repository" "primary" {
  project       = local.gcp_project_id
  location      = module.config.gcp_primary_location
  repository_id = module.config.project_name
  format        = "DOCKER"
  description   = "Primary artifact repository, shared across environments."

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# Outputs

output "gcp_ar_repo_endpoint" {
  description = "Artifact Registry repository endpoint, e.g. europe-west1-docker.pkg.dev/<project>/<repo>."
  value       = google_artifact_registry_repository.primary.registry_uri
}

output "gcp_ar_repo_project_id" {
  description = "The project holding the Artifact Registry repository."
  value       = google_artifact_registry_repository.primary.project
}

output "gcp_ar_repo_location" {
  description = "The Artifact Registry repository's location."
  value       = google_artifact_registry_repository.primary.location
}

output "gcp_ar_repo_name" {
  description = "The Artifact Registry repository's name."
  value       = google_artifact_registry_repository.primary.name
}
