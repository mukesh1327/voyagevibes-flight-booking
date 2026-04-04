import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import type { ApiResult, PaymentRecord } from '../../core/models/domain.models';
import { PaymentOpsService } from '../../core/services/payment-ops.service';
import { CorpWorkbenchStore } from '../../core/state/corp-workbench.store';

@Component({
  selector: 'app-corp-payments-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="space-y-8">
      <div class="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p class="text-xs uppercase tracking-[0.25em] text-slate-400">Payment desk</p>
          <h1 class="mt-2 font-['Space_Grotesk','Segoe_UI',sans-serif] text-3xl font-semibold text-slate-900">Create intent, authorize, capture, and refund</h1>

          <div class="mt-6 grid gap-4 md:grid-cols-2">
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Booking ID</span>
              <input [(ngModel)]="bookingId" name="bookingId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Amount</span>
              <input [(ngModel)]="amount" name="amount" type="number" min="1" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Provider</span>
              <select [(ngModel)]="provider" name="provider" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900">
                <option value="mock">Mock</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Currency</span>
              <input [(ngModel)]="currency" name="currency" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Provider payment ID</span>
              <input [(ngModel)]="providerPaymentId" name="providerPaymentId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block">
              <span class="mb-2 block text-sm text-slate-500">Provider order ID</span>
              <input [(ngModel)]="providerOrderId" name="providerOrderId" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
            <label class="block md:col-span-2">
              <span class="mb-2 block text-sm text-slate-500">Reason or operator note</span>
              <input [(ngModel)]="reason" name="reason" class="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900" />
            </label>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button type="button" (click)="createIntent()" class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Create intent
            </button>
            <button type="button" (click)="authorize()" class="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900">
              Authorize
            </button>
            <button type="button" (click)="capture()" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300">
              Capture
            </button>
            <button type="button" (click)="refund()" class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 transition hover:border-amber-300">
              Refund
            </button>
          </div>

          <div *ngIf="message()" class="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ message() }}
          </div>
          <div *ngIf="error()" class="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ error() }}
          </div>
        </section>

        <aside class="rounded-[2rem] bg-slate-950/92 p-6 text-white">
          <p class="text-xs uppercase tracking-[0.25em] text-cyan-300">Current payment</p>
          <ng-container *ngIf="workbench.currentPayment() as payment; else noPayment">
            <h2 class="mt-3 font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-semibold">{{ payment.paymentId }}</h2>
            <p class="mt-2 text-sm text-slate-300">Booking {{ payment.bookingId }} | {{ payment.provider || 'mock' }}</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <p class="mt-2 text-lg font-semibold">{{ payment.status }}</p>
              </div>
              <div class="rounded-2xl bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Amount</p>
                <p class="mt-2 text-lg font-semibold">{{ payment.currency }} {{ Math.round(payment.amount).toLocaleString('en-IN') }}</p>
              </div>
            </div>
            <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Order {{ payment.providerOrderId || 'not assigned' }} | Payment ref {{ payment.providerPaymentId || 'not assigned' }}
            </div>

            <a routerLink="/workspace/bookings" class="mt-6 inline-flex rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Return to booking confirmation
            </a>
          </ng-container>
          <ng-template #noPayment>
            <div class="mt-6 rounded-3xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-slate-400">
              Create a payment intent for the selected booking to start the lifecycle.
            </div>
          </ng-template>
        </aside>
      </div>
    </section>
  `,
})
export class CorpPaymentsPageComponent {
  protected readonly workbench = inject(CorpWorkbenchStore);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly Math = Math;

  private readonly paymentOps = inject(PaymentOpsService);

  protected bookingId = '';
  protected amount = 0;
  protected currency = 'INR';
  protected provider: 'mock' | 'razorpay' = 'mock';
  protected providerPaymentId = '';
  protected providerOrderId = '';
  protected reason = 'Corp operations desk action';

  constructor() {
    effect(() => {
      const booking = this.workbench.currentBooking();
      if (booking) {
        this.bookingId = booking.bookingId;
        this.amount = booking.quotedAmount || this.amount || 5800;
      }

      const payment = this.workbench.currentPayment();
      if (payment) {
        this.providerPaymentId = payment.providerPaymentId || this.providerPaymentId;
        this.providerOrderId = payment.providerOrderId || this.providerOrderId;
      }
    });
  }

  protected async createIntent(): Promise<void> {
    this.resetMessages();
    const response = await this.paymentOps.createIntent({
      bookingId: this.bookingId,
      amount: this.amount,
      currency: this.currency,
      provider: this.provider,
      metadata: {
        source: 'voyagevibes-corp-ui',
      },
    });

    this.handlePaymentResponse(response, 'Payment intent created.');
  }

  protected async authorize(): Promise<void> {
    const payment = this.workbench.currentPayment();
    if (!payment) {
      this.error.set('Create a payment intent before authorization.');
      return;
    }

    this.resetMessages();
    const response = await this.paymentOps.authorize({
      paymentId: payment.paymentId,
      providerPaymentId: this.providerPaymentId,
      providerOrderId: this.providerOrderId,
      amount: this.amount,
      reason: this.reason,
      metadata: { source: 'voyagevibes-corp-ui' },
    });

    this.handlePaymentResponse(response, 'Payment authorized.');
  }

  protected async capture(): Promise<void> {
    const payment = this.workbench.currentPayment();
    if (!payment) {
      this.error.set('Create a payment intent before capture.');
      return;
    }

    this.resetMessages();
    const response = await this.paymentOps.capture({
      paymentId: payment.paymentId,
      providerPaymentId: this.providerPaymentId,
      providerOrderId: this.providerOrderId,
      amount: this.amount,
      reason: this.reason,
      metadata: { source: 'voyagevibes-corp-ui' },
    });

    this.handlePaymentResponse(response, 'Payment captured. Return to booking desk to confirm the itinerary.');
  }

  protected async refund(): Promise<void> {
    const payment = this.workbench.currentPayment();
    if (!payment) {
      this.error.set('Select a payment before refund.');
      return;
    }

    this.resetMessages();
    const response = await this.paymentOps.refund({
      paymentId: payment.paymentId,
      providerPaymentId: this.providerPaymentId,
      providerOrderId: this.providerOrderId,
      amount: this.amount,
      reason: this.reason,
      metadata: { source: 'voyagevibes-corp-ui' },
    });

    this.handlePaymentResponse(response, 'Refund processed.');
  }

  private handlePaymentResponse(response: ApiResult<PaymentRecord>, successMessage: string): void {
    if (!response.success || !response.data) {
      this.error.set(response.error?.message || 'Payment action failed.');
      return;
    }

    this.workbench.setCurrentPayment(response.data);
    this.providerPaymentId = response.data.providerPaymentId || this.providerPaymentId;
    this.providerOrderId = response.data.providerOrderId || this.providerOrderId;
    this.message.set(successMessage);
    this.workbench.log(`${successMessage} (${response.data.paymentId}).`);
  }

  private resetMessages(): void {
    this.message.set('');
    this.error.set('');
  }
}
