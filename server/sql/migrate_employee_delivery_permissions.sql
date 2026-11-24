BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_permissions (
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission VARCHAR(32) NOT NULL
    CHECK (permission IN (
      'ASSIGN_DELIVERIES',
      'REASSIGN_DELIVERIES',
      'VIEW_ALL_DELIVERIES'
    )),
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, permission)
);

ALTER TABLE public.order_delivery_events
  ADD COLUMN IF NOT EXISTS previous_delivery_person_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(24) NOT NULL DEFAULT 'STATUS_CHANGED'
    CHECK (action_type IN ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED')),
  ADD COLUMN IF NOT EXISTS actor_role VARCHAR(24) NOT NULL DEFAULT 'system';

CREATE INDEX IF NOT EXISTS employee_permissions_permission_idx
  ON public.employee_permissions(permission, employee_id);

COMMIT;
