import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateMembershipRequest,
  MembershipRequest,
  MembershipRequestSummary,
  ReviewMembershipRequest,
} from '../interfaces/member-request.interface';
import { RequestStatus } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import requestsMock from '../../../assets/mock-data/membership-requests.json';

/**
 * Membership requests access.
 * Mock mode keeps an in-memory source of truth and notifies subscribers on mutations
 * so lists and the sidebar pending indicator stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class MembershipRequestService {
  private readonly http = inject(HttpClient);
  private requests: MembershipRequest[] = structuredClone(requestsMock) as MembershipRequest[];
  private readonly version$ = new BehaviorSubject(0);

  /** Emits whenever mock data changes (approve/reject/create). */
  readonly changes$ = this.version$.asObservable();

  getRequests(): Observable<MembershipRequest[]> {
    return this.list();
  }

  list(): Observable<MembershipRequest[]> {
    if (environment.useMocks) {
      return this.version$.pipe(switchMap(() => mockResponse([...this.requests])));
    }
    return this.http.get<MembershipRequest[]>(`${environment.apiBaseUrl}/membership-requests`);
  }

  getRequestById(id: string): Observable<MembershipRequest> {
    if (environment.useMocks) {
      return this.version$.pipe(
        switchMap(() => {
          const found = this.requests.find((item) => item.id === id);
          if (!found) {
            return throwError(() => ({
              status: 404,
              message: 'Solicitud no encontrada',
              code: 'REQUEST_NOT_FOUND',
            }));
          }
          return mockResponse(found);
        }),
      );
    }
    return this.http.get<MembershipRequest>(`${environment.apiBaseUrl}/membership-requests/${id}`);
  }

  getSummary(): Observable<MembershipRequestSummary> {
    return this.list().pipe(map((items) => this.toSummary(items)));
  }

  countPending(): Observable<number> {
    return this.list().pipe(
      map((requests) => requests.filter((request) => request.status === RequestStatus.Pendiente).length),
    );
  }

  create(payload: CreateMembershipRequest): Observable<MembershipRequest> {
    if (environment.useMocks) {
      const created: MembershipRequest = {
        id: `req-${String(this.requests.length + 1).padStart(3, '0')}`,
        ...payload,
        status: RequestStatus.Pendiente,
        submittedAt: new Date().toISOString(),
      };
      this.requests = [created, ...this.requests];
      this.bump();
      return mockResponse(created);
    }
    return this.http.post<MembershipRequest>(
      `${environment.apiBaseUrl}/membership-requests`,
      payload,
    );
  }

  approveRequest(id: string, reviewedBy: string, notes?: string): Observable<MembershipRequest> {
    return this.approve(id, reviewedBy, notes);
  }

  approve(id: string, reviewedBy: string, notes?: string): Observable<MembershipRequest> {
    return this.review(id, {
      status: RequestStatus.Aprobada,
      reviewedBy,
      notes,
    });
  }

  rejectRequest(
    id: string,
    reviewedBy: string,
    rejectionReason: string,
    notes?: string,
  ): Observable<MembershipRequest> {
    return this.reject(id, reviewedBy, rejectionReason, notes);
  }

  reject(
    id: string,
    reviewedBy: string,
    rejectionReason: string,
    notes?: string,
  ): Observable<MembershipRequest> {
    return this.review(id, {
      status: RequestStatus.Rechazada,
      reviewedBy,
      rejectionReason,
      notes,
    });
  }

  private review(id: string, payload: ReviewMembershipRequest): Observable<MembershipRequest> {
    if (environment.useMocks) {
      const index = this.requests.findIndex((item) => item.id === id);
      if (index < 0) {
        return throwError(() => ({
          status: 404,
          message: 'Solicitud no encontrada',
          code: 'REQUEST_NOT_FOUND',
        }));
      }

      const current = this.requests[index];
      const updated: MembershipRequest = {
        ...current,
        status: payload.status,
        reviewedBy: payload.reviewedBy,
        rejectionReason: payload.rejectionReason,
        notes: payload.notes ?? current.notes,
        reviewedAt: new Date().toISOString(),
      };
      this.requests = this.requests.map((item, i) => (i === index ? updated : item));
      this.bump();
      return mockResponse(updated);
    }

    return this.http.patch<MembershipRequest>(
      `${environment.apiBaseUrl}/membership-requests/${id}/review`,
      payload,
    );
  }

  private toSummary(items: MembershipRequest[]): MembershipRequestSummary {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === RequestStatus.Pendiente).length,
      approved: items.filter((item) => item.status === RequestStatus.Aprobada).length,
      rejected: items.filter((item) => item.status === RequestStatus.Rechazada).length,
    };
  }

  private bump(): void {
    this.version$.next(this.version$.value + 1);
  }
}
