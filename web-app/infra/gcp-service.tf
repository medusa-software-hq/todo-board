# The web app, on Cloud Run.
#
# It serves the built frontend and forwards `/api` to this environment's API service, which is what
# lets the page call its own origin. The Vite dev server plays the same part locally, so the browser
# crosses no origin in either place and the API needs no CORS policy at all.

resource "google_service_account" "web" {
  project      = var.gcp_project_id
  account_id   = "${module.config.gcp_web_run_service_name}-sa"
  display_name = "Web App Cloud Run Service Account"

}

resource "google_cloud_run_v2_service" "web" {
  project  = var.gcp_project_id
  name     = module.config.gcp_web_run_service_name
  location = module.config.gcp_primary_location
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account = google_service_account.web.email

    containers {
      # A placeholder until CI/CD deploys the real image; see the API service.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }

      # Where to forward `/api`. Set here rather than baked into the image, so the same image can be
      # deployed to staging and then to production without being rebuilt.
      env {
        name  = "API_URL"
        value = local.api_service_url
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    # noinspection HILUnresolvedReference
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

}

resource "google_cloud_run_v2_service_iam_member" "web_public_invoker" {
  project  = google_cloud_run_v2_service.web.project
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs

output "web_service_url" {
  description = "The web app's Cloud Run URL."
  value       = google_cloud_run_v2_service.web.uri
}
