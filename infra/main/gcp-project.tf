# This environment's own GCP project.
#
# One project per environment rather than one project with two of everything: a boundary that the
# IAM system enforces is the only kind that survives someone being in a hurry.

data "google_organization" "this" {
  domain = module.config.organization_domain
}

data "google_billing_account" "this" {
  display_name = "My Billing Account"
  open         = true
}

resource "random_id" "gcp_project_random_id" {
  byte_length = 2
}

resource "google_project" "this" {
  org_id          = data.google_organization.this.org_id
  billing_account = data.google_billing_account.this.id

  name       = "${module.config.project_name} - ${module.config.project_variant} - ${local.environment}"
  project_id = "${module.config.project_name}-${local.environment_code}-${random_id.gcp_project_random_id.hex}"

  auto_create_network = false

  # `PREVENT` is the provider's default, and it turns any failure during creation into a deadlock:
  # the project is tainted, so it must be replaced, and it cannot be deleted to replace it. These
  # projects hold nothing that is not in this repository, so re-applying is the right way out.
  deletion_policy = "DELETE"
}

locals {
  gcp_project_id = google_project.this.project_id
}

resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "orgpolicy.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
  ])

  project = google_project.this.project_id
  service = each.key

  disable_on_destroy = false
}

# Outputs

output "gcp_project_id" {
  description = "This environment's GCP project ID."
  value       = local.gcp_project_id
}
