import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { ApiResult, CorpAdminUserSnapshot, CorpRoleId, CorpUserStatus } from '../../core/models/domain.models';
import { CorpAdminService } from '../../core/services/corp-admin.service';
import { CorpSessionService } from '../../core/services/corp-session.service';
import { CorpWorkbenchStore } from '../../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="space-y-8">
      <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Admin desk</p>
        <h1 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-3xl font-semibold text-slate-900">
          Manage corp users, roles, and access controls
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
          This desk is aligned to the auth-service admin API surface for corp user creation, updates, role assignment,
          enable or disable actions, MFA reset, and session revocation.
        </p>
      </div>

      <section *ngIf="!hasAdminAccess()" class="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <p class="text-sm font-semibold">CORP_ADMIN access is required for admin operations.</p>
        <p class="mt-2 text-sm text-amber-800">
          Your current session can continue using dashboard, flights, bookings, and payments, but admin actions stay restricted.
        </p>
      </section>

      <ng-container *ngIf="hasAdminAccess()">
        <div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Create corp user</p>
            <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">
              Provision a new workforce user
            </h2>

            <div class="mt-6 grid gap-4 md:grid-cols-2">
              <label class="block md:col-span-2">
                <span class="mb-2 block text-sm text-slate-500">Corporate email</span>
                <input [(ngModel)]="createEmail" name="createEmail" type="email" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Department</span>
                <input [(ngModel)]="createDepartment" name="createDepartment" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Manager ID</span>
                <input [(ngModel)]="createManagerId" name="createManagerId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
            </div>

            <div class="mt-6">
              <p class="text-sm font-medium text-slate-900">Role assignments</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label *ngFor="let role of availableRoles" class="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" [checked]="createRoles.includes(role)" (change)="toggleCreateRole(role, $any($event.target).checked)" />
                  <span>{{ role }}</span>
                </label>
              </div>
            </div>

            <button type="button" (click)="createUser()" class="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Create corp user
            </button>
          </section>

          <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Manage existing user</p>
            <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">
              Apply admin controls by user ID
            </h2>
            <p class="mt-3 text-sm text-slate-500">
              The current auth-service contract guarantees write actions here. Management actions should target a known corp user ID.
            </p>

            <div class="mt-6 grid gap-4 md:grid-cols-2">
              <label class="block md:col-span-2">
                <span class="mb-2 block text-sm text-slate-500">Corp user ID</span>
                <input [(ngModel)]="targetUserId" name="targetUserId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block md:col-span-2">
                <span class="mb-2 block text-sm text-slate-500">Reference email</span>
                <input [(ngModel)]="targetEmail" name="targetEmail" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Status</span>
                <select [(ngModel)]="updateStatus" name="updateStatus" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Role action target</span>
                <select [(ngModel)]="roleId" name="roleId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900">
                  <option *ngFor="let role of availableRoles" [value]="role">{{ role }}</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Department</span>
                <input [(ngModel)]="updateDepartment" name="updateDepartment" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-500">Manager ID</span>
                <input [(ngModel)]="updateManagerId" name="updateManagerId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
              </label>
            </div>

            <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <button type="button" (click)="updateUser()" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                Update user
              </button>
              <button type="button" (click)="enableUser()" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300">
                Enable user
              </button>
              <button type="button" (click)="disableUser()" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300">
                Disable user
              </button>
              <button type="button" (click)="assignRole()" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                Assign role
              </button>
              <button type="button" (click)="removeRole()" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
                Remove role
              </button>
              <button type="button" (click)="forceMfaReset()" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:border-amber-300">
                Force MFA reset
              </button>
            </div>

            <button type="button" (click)="revokeAllSessions()" class="mt-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
              Revoke all sessions
            </button>
          </section>
        </div>

        <div *ngIf="message()" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {{ message() }}
        </div>
        <div *ngIf="error()" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ error() }}
        </div>

        <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Admin action log</p>
              <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold text-slate-900">
                Recent corp user actions
              </h2>
            </div>
            <p class="text-sm text-slate-500">Local tracking of requests sent to the auth-service admin APIs.</p>
          </div>

          <div *ngIf="workbench.adminUsers().length; else emptyState" class="mt-6 grid gap-4 xl:grid-cols-2">
            <article *ngFor="let user of workbench.adminUsers()" class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p class="text-lg font-semibold text-slate-900">{{ user.email || 'Email not captured' }}</p>
                  <p class="mt-1 text-sm text-slate-500">{{ user.userId || 'User ID not yet tracked' }}</p>
                </div>
                <button type="button" (click)="useSnapshot(user)" class="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:border-slate-900">
                  Use in form
                </button>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                  <p class="mt-1 text-sm font-medium text-slate-900">{{ user.status }}</p>
                </div>
                <div class="rounded-2xl bg-white px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Roles</p>
                  <p class="mt-1 text-sm font-medium text-slate-900">{{ user.roles.join(' | ') || 'None' }}</p>
                </div>
              </div>

              <p class="mt-4 text-sm text-slate-500">{{ user.lastAction }}</p>
              <p class="mt-1 text-xs text-slate-400">Updated {{ user.updatedAt | date: 'medium' }}</p>
            </article>
          </div>

          <ng-template #emptyState>
            <div class="mt-6 rounded-3xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
              Admin actions will appear here after you create or manage corp users.
            </div>
          </ng-template>
        </section>
      </ng-container>
    </section>
  `,
})
export class CorpAdminPageComponent {
  protected readonly session = inject(CorpSessionService);
  protected readonly workbench = inject(CorpWorkbenchStore);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly hasAdminAccess = computed(
    () => this.session.session()?.user?.roles?.includes('CORP_ADMIN') ?? false,
  );
  protected readonly availableRoles: CorpRoleId[] = ['CORP_ADMIN', 'OPS_AGENT', 'SUPPORT_AGENT', 'FINANCE_AGENT'];

  private readonly adminService = inject(CorpAdminService);

  protected createEmail = '';
  protected createDepartment = '';
  protected createManagerId = '';
  protected createRoles: CorpRoleId[] = ['OPS_AGENT'];

  protected targetUserId = '';
  protected targetEmail = '';
  protected updateStatus: CorpUserStatus = 'ACTIVE';
  protected updateDepartment = '';
  protected updateManagerId = '';
  protected roleId: CorpRoleId = 'OPS_AGENT';

  constructor() {
    effect(() => {
      const selected = this.workbench.currentAdminUser();
      if (!selected) {
        return;
      }

      this.targetUserId = selected.userId || this.targetUserId;
      this.targetEmail = selected.email || this.targetEmail;
      this.updateStatus = selected.status;
      this.updateDepartment = selected.department || '';
      this.updateManagerId = selected.managerId || '';
      this.roleId = selected.roles[0] || this.roleId;
    });
  }

  protected toggleCreateRole(role: CorpRoleId, checked: boolean): void {
    if (checked) {
      if (!this.createRoles.includes(role)) {
        this.createRoles = [...this.createRoles, role];
      }
      return;
    }

    this.createRoles = this.createRoles.filter((item) => item !== role);
  }

  protected async createUser(): Promise<void> {
    this.resetMessages();

    if (!this.createEmail.trim()) {
      this.error.set('Corporate email is required.');
      return;
    }

    if (!this.createRoles.length) {
      this.error.set('Select at least one role.');
      return;
    }

    const response = await this.adminService.createUser({
      email: this.createEmail.trim(),
      roleIds: this.createRoles,
      department: this.normalizeBlank(this.createDepartment),
      managerId: this.normalizeBlank(this.createManagerId),
    });

    this.handleAdminResponse(response, `Corp user ${this.createEmail.trim()} created.`, () => {
      const snapshot: CorpAdminUserSnapshot = {
        trackingKey: this.createEmail.trim().toLowerCase(),
        email: this.createEmail.trim(),
        status: 'ACTIVE',
        roles: [...this.createRoles],
        department: this.normalizeBlank(this.createDepartment),
        managerId: this.normalizeBlank(this.createManagerId),
        updatedAt: new Date().toISOString(),
        lastAction: 'Created corp user in auth-service.',
      };
      this.workbench.upsertAdminUser(snapshot);
      this.workbench.log(`Created corp user ${snapshot.email} from admin desk.`);
      this.targetEmail = snapshot.email;
      this.updateDepartment = snapshot.department || '';
      this.updateManagerId = snapshot.managerId || '';
    });
  }

  protected async updateUser(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.updateUser(userId, {
      status: this.updateStatus,
      department: this.normalizeBlank(this.updateDepartment),
      managerId: this.normalizeBlank(this.updateManagerId),
    });

    this.handleAdminResponse(response, `Corp user ${userId} updated.`, () => {
      this.saveSnapshot(userId, {
        status: this.updateStatus,
        department: this.normalizeBlank(this.updateDepartment),
        managerId: this.normalizeBlank(this.updateManagerId),
        lastAction: 'Updated corp user profile fields.',
      });
      this.workbench.log(`Updated corp user ${userId}.`);
    });
  }

  protected async enableUser(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.enableUser(userId);
    this.handleAdminResponse(response, `Corp user ${userId} enabled.`, () => {
      this.updateStatus = 'ACTIVE';
      this.saveSnapshot(userId, {
        status: 'ACTIVE',
        lastAction: 'Enabled corp user.',
      });
      this.workbench.log(`Enabled corp user ${userId}.`);
    });
  }

  protected async disableUser(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.disableUser(userId);
    this.handleAdminResponse(response, `Corp user ${userId} disabled.`, () => {
      this.updateStatus = 'DISABLED';
      this.saveSnapshot(userId, {
        status: 'DISABLED',
        lastAction: 'Disabled corp user and revoked sessions.',
      });
      this.workbench.log(`Disabled corp user ${userId}.`);
    });
  }

  protected async assignRole(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.assignRole(userId, { roleId: this.roleId });
    this.handleAdminResponse(response, `Role ${this.roleId} assigned to ${userId}.`, () => {
      const currentRoles = this.findSnapshot(userId)?.roles || [];
      const nextRoles = currentRoles.includes(this.roleId) ? currentRoles : [...currentRoles, this.roleId];
      this.saveSnapshot(userId, {
        roles: nextRoles,
        lastAction: `Assigned role ${this.roleId}.`,
      });
      this.workbench.log(`Assigned role ${this.roleId} to corp user ${userId}.`);
    });
  }

  protected async removeRole(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.removeRole(userId, this.roleId);
    this.handleAdminResponse(response, `Role ${this.roleId} removed from ${userId}.`, () => {
      const currentRoles = this.findSnapshot(userId)?.roles || [];
      this.saveSnapshot(userId, {
        roles: currentRoles.filter((role) => role !== this.roleId),
        lastAction: `Removed role ${this.roleId}.`,
      });
      this.workbench.log(`Removed role ${this.roleId} from corp user ${userId}.`);
    });
  }

  protected async forceMfaReset(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.forceMfaReset(userId);
    this.handleAdminResponse(response, `MFA reset triggered for ${userId}.`, () => {
      this.saveSnapshot(userId, {
        lastAction: 'Forced MFA reset.',
      });
      this.workbench.log(`Forced MFA reset for corp user ${userId}.`);
    });
  }

  protected async revokeAllSessions(): Promise<void> {
    const userId = this.requireTargetUserId();
    if (!userId) {
      return;
    }

    this.resetMessages();
    const response = await this.adminService.revokeAllSessions(userId);
    this.handleAdminResponse(response, `All sessions revoked for ${userId}.`, () => {
      this.saveSnapshot(userId, {
        lastAction: 'Revoked all sessions.',
      });
      this.workbench.log(`Revoked all sessions for corp user ${userId}.`);
    });
  }

  protected useSnapshot(user: CorpAdminUserSnapshot): void {
    this.resetMessages();
    this.workbench.setCurrentAdminUser(user);
    this.message.set(`Loaded ${user.userId || user.email} into the admin form.`);
  }

  private handleAdminResponse(response: ApiResult<void>, successMessage: string, onSuccess: () => void): void {
    if (!response.success) {
      this.error.set(response.error?.message || 'Admin action failed.');
      return;
    }

    onSuccess();
    this.message.set(successMessage);
  }

  private saveSnapshot(
    userId: string,
    patch: Partial<CorpAdminUserSnapshot> & { lastAction: string },
  ): void {
    const existing = this.findSnapshot(userId);
    this.workbench.upsertAdminUser({
      trackingKey: existing?.trackingKey || userId,
      userId,
      email: this.targetEmail.trim() || existing?.email || '',
      status: patch.status || existing?.status || this.updateStatus,
      roles: patch.roles || existing?.roles || [],
      department: patch.department !== undefined ? patch.department : existing?.department,
      managerId: patch.managerId !== undefined ? patch.managerId : existing?.managerId,
      updatedAt: new Date().toISOString(),
      lastAction: patch.lastAction,
    });
  }

  private findSnapshot(userId: string): CorpAdminUserSnapshot | undefined {
    return this.workbench.adminUsers().find(
      (item) => item.userId?.toLowerCase() === userId.toLowerCase() || item.trackingKey.toLowerCase() === userId.toLowerCase(),
    );
  }

  private requireTargetUserId(): string | null {
    const value = this.targetUserId.trim();
    if (!value) {
      this.error.set('Corp user ID is required for this action.');
      return null;
    }
    return value;
  }

  private normalizeBlank(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private resetMessages(): void {
    this.message.set('');
    this.error.set('');
  }
}