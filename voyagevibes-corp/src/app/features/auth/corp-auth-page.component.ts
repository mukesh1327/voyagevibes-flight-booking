import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import type { CorpMfaChallengeResponse } from '../../core/models/domain.models';
import { CorpAuthService } from '../../core/services/corp-auth.service';

@Component({
  selector: 'app-corp-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.22),_transparent_32%),linear-gradient(135deg,_#040814,_#0f172a_55%,_#0a1c37)] px-5 py-8 text-white md:px-10">
      <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section class="w-full rounded-[2rem] border border-white/10 bg-slate-950/55 p-8 backdrop-blur xl:p-10">
          <div class="text-center">
            <p class="text-xs uppercase tracking-[0.35em] text-cyan-300">VoyageVibes Corp</p>
            <h1 class="mt-4 font-['Space_Grotesk','Segoe_UI',sans-serif] text-4xl font-semibold text-white">
              Sign in
            </h1>
            <p class="mt-3 text-sm text-slate-300">Use your corporate account to continue.</p>
          </div>

          <div class="mt-8 flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Secure access</p>
              <h2 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold">Corp account</h2>
            </div>
            <span class="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
              {{ stepLabel() }}
            </span>
          </div>

          <form class="mt-8 space-y-6" (ngSubmit)="submitCurrentStep()">
            <div *ngIf="step() === 'init'" class="space-y-4">
              <label class="block">
                <span class="mb-2 block text-sm text-slate-300">Corporate email</span>
                <input
                  [(ngModel)]="email"
                  name="email"
                  type="email"
                  class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  placeholder="staff@airline.com"
                  required
                />
              </label>
              <label class="block">
                <span class="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  [(ngModel)]="password"
                  name="password"
                  type="password"
                  class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  placeholder="Enter your corporate password"
                  required
                />
              </label>
            </div>

            <div *ngIf="step() === 'verify'" class="space-y-4">
              <ng-container *ngIf="factorType === 'PASSWORD'; else advancedPrimary">
                <label class="block">
                  <span class="mb-2 block text-sm text-slate-300">Password</span>
                  <input
                    [(ngModel)]="password"
                    name="password"
                    type="password"
                    class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    placeholder="Enter your corporate password"
                    required
                  />
                </label>
              </ng-container>
              <ng-template #advancedPrimary>
                <label class="block">
                  <span class="mb-2 block text-sm text-slate-300">Passkey assertion</span>
                  <textarea
                    [(ngModel)]="primaryAssertion"
                    name="primaryAssertion"
                    rows="4"
                    class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    placeholder="Paste assertion JSON"
                  ></textarea>
                </label>
              </ng-template>
            </div>

            <div *ngIf="step() === 'challenge'" class="space-y-4">
              <div *ngIf="challengePreview()" class="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                {{ challengePreview() }}
              </div>

              <ng-container *ngIf="mfaFactor === 'TOTP' || mfaFactor === 'OTP'; else advancedMfa">
                <label class="block">
                  <span class="mb-2 block text-sm text-slate-300">Authenticator code</span>
                  <input
                    [(ngModel)]="challengeAnswer"
                    name="challengeAnswer"
                    inputmode="numeric"
                    class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    placeholder="Enter 6-digit code"
                  />
                </label>
              </ng-container>
              <ng-template #advancedMfa>
                <label class="block">
                  <span class="mb-2 block text-sm text-slate-300">MFA assertion</span>
                  <input
                    [(ngModel)]="challengeAnswer"
                    name="challengeAnswer"
                    class="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white outline-none focus:border-cyan-300"
                    placeholder="Paste assertion JSON"
                  />
                </label>
              </ng-template>
            </div>

            <div *ngIf="error()" class="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {{ error() }}
            </div>

            <div *ngIf="info()" class="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {{ info() }}
            </div>

            <button
              type="submit"
              [disabled]="submitting()"
              class="w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ submitting() ? 'Working...' : actionLabel() }}
            </button>
          </form>
        </section>
      </div>
    </div>
  `,
})
export class CorpAuthPageComponent {
  private readonly auth = inject(CorpAuthService);
  private readonly router = inject(Router);

  protected readonly step = signal<'init' | 'verify' | 'challenge'>('init');
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly loginFlowId = signal('');
  protected readonly allowedFactors = signal<string[]>(['PASSWORD']);
  protected readonly challengeToken = signal('');
  protected readonly challengePreview = signal('');

  protected email = 'staff@airline.com';
  protected factorType = 'PASSWORD';
  protected primaryAssertion = '';
  protected mfaFactor = 'TOTP';
  protected password = '';
  protected challengeAnswer = '';

  protected stepLabel(): string {
    switch (this.step()) {
      case 'verify':
        return 'Verify';
      case 'challenge':
        return 'Security check';
      default:
        return 'Sign in';
    }
  }

  protected actionLabel(): string {
    switch (this.step()) {
      case 'verify':
        return 'Verify';
      case 'challenge':
        return 'Continue';
      default:
        return 'Sign in';
    }
  }

  protected async submitCurrentStep(): Promise<void> {
    if (this.step() === 'init') {
      await this.startLogin();
      return;
    }

    if (this.step() === 'verify') {
      await this.verifyPrimary();
      return;
    }

    await this.verifyMfa();
  }

  private async startLogin(): Promise<void> {
    this.resetMessages();
    this.submitting.set(true);

    const response = await this.auth.initLogin(this.email);
    this.submitting.set(false);

    if (!response.success || !response.data) {
      this.handleError(response.error?.message || 'Unable to initiate corp login.');
      return;
    }

    this.loginFlowId.set(response.data.loginFlowId);
    this.allowedFactors.set(response.data.allowedFactors);
    const preferredPrimary = response.data.allowedFactors.includes('PASSWORD') ? 'PASSWORD' : response.data.allowedFactors[0] || 'PASSKEY';
    this.factorType = preferredPrimary;
    const preferredMfa = response.data.allowedFactors.includes('TOTP')
      ? 'TOTP'
      : response.data.allowedFactors.find((item) => item !== preferredPrimary) || response.data.allowedFactors[0] || 'TOTP';
    this.mfaFactor = preferredMfa;
    this.step.set('verify');
    this.info.set('Corp login initialized. Continue with password verification.');

    if (this.factorType === 'PASSWORD' && this.password.trim()) {
      await this.verifyPrimary();
    }
  }

  private async verifyPrimary(): Promise<void> {
    this.resetMessages();
    if (this.factorType === 'PASSWORD' && !this.password.trim()) {
      this.error.set('Enter your corporate password to continue.');
      return;
    }

    this.submitting.set(true);

    const response = await this.auth.verifyPrimaryFactor({
      loginFlowId: this.loginFlowId(),
      factorType: this.factorType,
      assertion: this.factorType === 'PASSWORD' ? this.password : this.primaryAssertion,
    });

    this.submitting.set(false);

    if (!response.success || !response.data) {
      this.handleError(response.error?.message || 'Primary-factor verification failed.');
      return;
    }

    if (response.data.session) {
      this.info.set('Primary factor completed. Session issued.');
      await this.router.navigateByUrl('/workspace/dashboard');
      return;
    }

    this.step.set('challenge');
    this.info.set(`Primary factor accepted. ${response.data.challengeType || 'MFA'} is now required.`);
    await this.requestMfaChallenge();
  }

  private async requestMfaChallenge(): Promise<void> {
    const response = await this.auth.challengeMfa({
      loginFlowId: this.loginFlowId(),
      factorType: this.mfaFactor,
    });

    if (!response.success || !response.data) {
      this.handleError(response.error?.message || 'Unable to start MFA challenge.');
      return;
    }

    this.captureChallenge(response.data);
  }

  private captureChallenge(challenge: CorpMfaChallengeResponse): void {
    const token = 'challengeId' in challenge ? challenge.challengeId : challenge.challenge;
    this.challengeToken.set(token);
    this.challengePreview.set(
      'challengeId' in challenge
        ? `OTP challenge issued. Challenge ID ${challenge.challengeId} expires in ${challenge.expiresIn}s.`
        : `Passkey challenge issued for RP ${challenge.rpId}. Timeout ${challenge.timeout}ms.`,
    );
  }

  private async verifyMfa(): Promise<void> {
    this.resetMessages();
    this.submitting.set(true);

    const response = await this.auth.verifyMfa({
      challengeId: this.challengeToken(),
      otpOrAssertion: this.challengeAnswer,
    });

    this.submitting.set(false);

    if (!response.success || !response.data) {
      this.handleError(response.error?.message || 'MFA verification failed.');
      return;
    }

    this.info.set('Session established. Entering corp workspace.');
    await this.router.navigateByUrl('/workspace/dashboard');
  }

  private resetMessages(): void {
    this.error.set('');
    this.info.set('');
  }

  private handleError(message: string): void {
    const normalized = message.toLowerCase();
    if (normalized.includes('expired') || normalized.includes('invalid')) {
      this.step.set('init');
      this.loginFlowId.set('');
      this.info.set('Login flow expired. Please start again.');
      return;
    }
    this.error.set(message);
  }
}
