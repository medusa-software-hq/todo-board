# Configuration

terraform {
  required_version = ">= 1.15"

  backend "gcs" {
    # Organization's central Terraform state bucket
    bucket = "ms-tfstate-c1984596bdabf023"
    prefix = "projects/todo-board/v1/shared"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.25"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.8"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.11"
    }
  }
}

# Module imports

module "config" {
  source = "../../config"
}

# The organization's own stack, which owns the Workload Identity pool CI/CD federates through.

data "terraform_remote_state" "meta" {
  backend = "gcs"

  config = {
    bucket = module.config.gcp_terraform_state_bucket_name
    prefix = module.config.gcp_state_prefix_meta_foundation
  }
}

# Providers

# Pointed at the meta project, not the one this stack creates: a provider configured with its own
# resource's output is a cycle. Every resource here names its project explicitly.
provider "google" {
  project = module.config.gcp_meta_project_id
  region  = module.config.gcp_primary_location
}

# GitHub provider, for publishing what CI needs to know. The repository itself is `infra/repo`'s;
# here it is only read.

variable "gh_token" {
  description = "Organization-owned GitHub token."
  type        = string
  sensitive   = true
}

provider "github" {
  owner = module.config.gh_organization_name
  token = var.gh_token
}
