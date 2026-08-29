# Configuration

terraform {
  required_version = ">= 1.15"

  backend "gcs" {
    # Organization's central Terraform state bucket. Workspaces keep each environment's state under
    # this one prefix, so `prod` and `staging` are the same configuration and not a copied one.
    bucket = "ms-tfstate-c1984596bdabf023"
    prefix = "projects/todo-board/v1/main"
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

# The shared stack owns the project the images live in and the identity that deploys them.

data "terraform_remote_state" "shared" {
  backend = "gcs"

  config = {
    bucket = module.config.gcp_terraform_state_bucket_name
    prefix = module.config.gcp_state_prefix_shared
  }
}

# Environments

locals {
  # Everything that differs between environments, and nothing that does not. There is no `default`
  # workspace here: an environment is chosen deliberately or not at all.
  environments = {
    prod = {
      # A letter rather than the word, so a derived name stays short enough to read at a glance:
      # `todo-board-p-1a2b`.
      environment_code = "p"

      # The OAuth client this environment signs people in with, and the audience its tokens name.
      # Written down rather than created here: an OAuth client is made through the console, which
      # Terraform has no way to reach — `automaton` drives that console for us. The id is public;
      # the secret it came with is unused, because a browser cannot keep one.
      google_client_id = "835797084385-sjmhumf0tp97aj873an9pngje2jvchqr.apps.googleusercontent.com"
    }
    staging = {
      environment_code = "s"

      google_client_id = "147866725365-ktjv9hddku493saogbnusp90237ju2n9.apps.googleusercontent.com"
    }
  }

  environment = terraform.workspace

  # There is no environment but these: a workspace that is not one of them has no code, and the
  # lookup failing is the whole of what needs to happen.
  environment_code = local.environments[local.environment].environment_code
  google_client_id = local.environments[local.environment].google_client_id
}

# Providers

# Pointed at the meta project, not the one this stack creates: a provider configured with its own
# resource's output is a cycle. Every resource here names its project explicitly.
provider "google" {
  project = module.config.gcp_meta_project_id
  region  = module.config.gcp_primary_location
}

# The Organization Policy API bills its quota to a project, and under a person's own credentials
# there is none to bill unless one is named. Only the org policy override below uses this.
provider "google" {
  alias   = "quota_override"
  project = module.config.gcp_meta_project_id
  region  = module.config.gcp_primary_location

  user_project_override = true
  billing_project       = local.gcp_project_id
}

# Outputs

output "environment" {
  description = "The environment this workspace deploys."
  value       = local.environment
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
