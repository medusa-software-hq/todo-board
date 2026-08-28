# The identity the Cloudflare edge calls Cloud Run as.
#
# It exists here, in root infra, because standing it up means relaxing an organization policy — and
# that is the kind of privilege this stack holds and CI is not given.
#
# Per environment, deliberately: a leaked staging key can call staging and stops there.

resource "google_service_account" "edge_invoker" {
  project      = local.gcp_project_id
  account_id   = "edge-invoker"
  display_name = "Cloudflare Edge Invoker"

  depends_on = [google_project_service.apis["iam.googleapis.com"]]
}

# The organization forbids service account keys, and means to. A Cloudflare Worker cannot federate
# into Google — it has no OIDC identity of its own that Workload Identity Federation can trust — so
# calling an IAM-locked service requires a key, and there is nowhere else to put it.
#
# Relaxed for this project alone, and never without the expiry below: the two belong together, and
# a commit that carried only the first would be trading a control for a promise.
resource "google_org_policy_policy" "allow_service_account_keys" {
  provider = google.quota_override

  name   = "projects/${local.gcp_project_id}/policies/iam.disableServiceAccountKeyCreation"
  parent = "projects/${local.gcp_project_id}"

  spec {
    rules {
      enforce = "FALSE"
    }
  }

  depends_on = [google_project_service.apis["orgpolicy.googleapis.com"]]
}

# What makes rotation a fact rather than an intention: a key that is not replaced within the week
# stops working. The rotation runs daily, so six missed runs are survivable and the seventh is not.
resource "google_org_policy_policy" "service_account_key_expiry" {
  provider = google.quota_override

  name   = "projects/${local.gcp_project_id}/policies/iam.serviceAccountKeyExpiryHours"
  parent = "projects/${local.gcp_project_id}"

  spec {
    rules {
      values {
        allowed_values = ["168h"]
      }
    }
  }

  depends_on = [google_project_service.apis["orgpolicy.googleapis.com"]]
}

# CI mints and deletes keys for this one account, and no other. It holds no key itself — it
# federates — so the only long-lived credential in the system is the one being rotated, and the
# thing that rotates it has none.
resource "google_service_account_iam_member" "cicd_edge_key_admin" {
  service_account_id = google_service_account.edge_invoker.name
  role               = "roles/iam.serviceAccountKeyAdmin"
  member             = "serviceAccount:${local.cicd_service_account_email}"
}

# Outputs

output "gcp_edge_invoker_sa_email" {
  description = "The account the edge calls Cloud Run as."
  value       = google_service_account.edge_invoker.email
}
