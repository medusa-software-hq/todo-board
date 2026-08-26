# Configuration
#
# Applied by CI, as the identity root infra created — not by hand and not with anyone's own
# credentials. Root infra owns the project and the permissions; this stack owns what runs in it.

terraform {
  required_version = ">= 1.15"

  backend "gcs" {
    # Organization's central Terraform state bucket
    bucket = "ms-tfstate-c1984596bdabf023"
    prefix = "projects/todo-board/v1/backend"
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

# Providers

provider "google" {
  project = var.gcp_project_id
  region  = module.config.gcp_primary_location
}
