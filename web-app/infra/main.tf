# Configuration
#
# Applied by CI, as the identity root infra created. See `backend/infra` for the same note.

terraform {
  required_version = ">= 1.15"

  backend "gcs" {
    # Organization's central Terraform state bucket
    bucket = "ms-tfstate-c1984596bdabf023"
    prefix = "projects/todo-board/v1/web-app"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.25"
    }
  }
}

# Module imports

module "config" {
  source = "../../config"
}

# What environment this is deploying into.
#
# Passed in rather than read from root infra's state: root infra publishes it as an Actions variable
# already, and the workflow hands that straight to Terraform. One copy, no second stack to read, and
# no need for this stack to be allowed to read root state at all.

variable "gcp_project_id" {
  description = "The GCP project to deploy into."
  type        = string
}

# The web app forwards `/api` to this environment's API, so it has to be told where that is. Read
# from the API's own state rather than written down again.
data "terraform_remote_state" "backend" {
  backend   = "gcs"
  workspace = terraform.workspace

  config = {
    bucket = module.config.gcp_terraform_state_bucket_name
    prefix = module.config.gcp_state_prefix_backend
  }
}

locals {
  # Still remote state, because this one is produced by the sibling stack rather than by root infra:
  # the API's URL exists only once its service does.
  api_service_url = data.terraform_remote_state.backend.outputs.api_service_url
}

# Providers

provider "google" {
  project = var.gcp_project_id
  region  = module.config.gcp_primary_location
}
