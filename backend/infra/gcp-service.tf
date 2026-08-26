# The API, on Cloud Run.
#
# Reached directly rather than through API Gateway: the gateway is configured from an OpenAPI 2.0
# document and this project's contract is 3.0, so putting one in front would mean a second,
# downgraded copy of the contract to keep in step with the first. Nothing yet needs what a gateway
# offers over this — no API keys, no quotas, no auth.

resource "google_service_account" "api" {
  project      = var.gcp_project_id
  account_id   = "${module.config.gcp_api_run_service_name}-sa"
  display_name = "API Cloud Run Service Account"

}

resource "google_cloud_run_v2_service" "api" {
  project  = var.gcp_project_id
  name     = module.config.gcp_api_run_service_name
  location = module.config.gcp_primary_location
  ingress  = "INGRESS_TRAFFIC_ALL"

  # Nothing here is precious yet: the counters live in memory and go with the revision.
  deletion_protection = false

  template {
    service_account = google_service_account.api.email

    containers {
      # A placeholder, so this stack can be applied before anything has ever been built. CI/CD
      # deploys the real image, which is why `image` is ignored below.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        # Cloud Run hands this to the container as `PORT`, and routes to it.
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    # The image is whatever CI/CD last deployed. Terraform owning it would mean every apply rolled
    # the service back to the placeholder.
    # noinspection HILUnresolvedReference
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

}

# Public, because the web app talks to it and there is nothing to protect yet.
resource "google_cloud_run_v2_service_iam_member" "api_public_invoker" {
  project  = google_cloud_run_v2_service.api.project
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs

output "api_service_url" {
  description = "The API's Cloud Run URL."
  value       = google_cloud_run_v2_service.api.uri
}
