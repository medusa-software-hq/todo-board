# The project holding what every environment shares.
#
# Shared rather than per-environment because what lives here is not part of any one deployment: an
# image is built once and deployed to staging and then to production, and it is the *same* image or
# the promotion proved nothing.

data "google_organization" "this" {
  domain = module.config.organization_domain
}

data "google_billing_account" "this" {
  display_name = "My Billing Account"
  open         = true
}

# Project ids are globally unique, so one carries a random suffix rather than a name someone has to
# keep unique by hand.
resource "random_id" "gcp_project_random_id" {
  byte_length = 2
}

resource "google_project" "this" {
  org_id          = data.google_organization.this.org_id
  billing_account = data.google_billing_account.this.id

  name = "${module.config.project_name} - ${module.config.project_variant} - shared"
  # `x` as in cross-environment.
  project_id = "${module.config.project_name}-x-${random_id.gcp_project_random_id.hex}"

  # Nothing here runs in a VPC, and the default network is a firewall surface nobody asked for.
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
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
  ])

  project = google_project.this.project_id
  service = each.key

  # Turning an API off because a resource went away breaks whatever else was quietly using it.
  disable_on_destroy = false
}

# Outputs

output "gcp_shared_project_id" {
  description = "The shared GCP project's ID."
  value       = local.gcp_project_id
}
