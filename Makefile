# FVCE — one-line shortcuts for the docker compose stack.
# All commands assume `.env` is filled in. Run `make help` to see the list.

SHELL := /bin/bash
COMPOSE := docker compose

.PHONY: help up down restart build logs ps shell-portal shell-dispatcher \
        leads-list leads-pending leads-failed approve-all backup-leads \
        verify

help:  ## list available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

up:  ## build images and start everything in the background
	$(COMPOSE) up -d --build

down:  ## stop and remove containers (volumes preserved)
	$(COMPOSE) down

restart:  ## restart all services
	$(COMPOSE) restart

build:  ## rebuild images without starting
	$(COMPOSE) build

logs:  ## tail logs for portal + dispatcher
	$(COMPOSE) logs -f portal dispatcher

ps:  ## show running services
	$(COMPOSE) ps

shell-portal:  ## shell into the portal container
	$(COMPOSE) exec portal sh

shell-dispatcher:  ## shell into the dispatcher container
	$(COMPOSE) exec dispatcher sh

# --- lead queue management (passthroughs to leads.py inside dispatcher) ---

leads-list:  ## show recent leads (override: ARGS='--status APPROVED --limit 10')
	$(COMPOSE) exec dispatcher python /app/leads.py list $(ARGS)

leads-pending:  ## list leads awaiting approval
	$(COMPOSE) exec dispatcher python /app/leads.py list --status PENDING

leads-failed:  ## list leads that hit the retry cap
	$(COMPOSE) exec dispatcher python /app/leads.py list --status FAILED

approve-all:  ## approve every PENDING lead in one go
	$(COMPOSE) exec dispatcher python /app/leads.py approve --all-pending

backup-leads:  ## copy lead_queue.db out of the volume to ./backups/
	@mkdir -p backups
	@ts=$$(date -u +%Y%m%dT%H%M%SZ); \
	  $(COMPOSE) exec -T dispatcher cat /data/lead_queue.db \
	  > backups/lead_queue.$$ts.db && \
	  echo "saved backups/lead_queue.$$ts.db"

verify:  ## syntax-check dispatcher + leads CLI without running them
	python3 -m py_compile workers/email_dispatcher/dispatcher.py
	python3 -m py_compile workers/email_dispatcher/leads.py
	python3 -c "import sqlite3; sqlite3.connect(':memory:').executescript(open('workers/email_dispatcher/schema.sql').read())"
	bash -n scripts/create_gui_shortcuts.sh
	@echo "all files parse cleanly"
