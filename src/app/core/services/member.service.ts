import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateMemberRequest,
  Member,
  MemberDetail,
  UpdateMemberRequest,
} from '../interfaces/member.interface';
import { FeeStatus, MemberPlan } from '../../shared/enums';
import { mockResponse } from '../utils/mock.util';
import membersMock from '../../../assets/mock-data/members.json';

const PLAN_FEES: Record<MemberPlan, number> = {
  [MemberPlan.Oro]: 3500,
  [MemberPlan.Plata]: 2800,
  [MemberPlan.Premium]: 4500,
};

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly http = inject(HttpClient);
  private members: Member[] = structuredClone(membersMock) as Member[];
  private readonly version$ = new BehaviorSubject(0);

  getMembers(): Observable<Member[]> {
    return this.list();
  }

  list(): Observable<Member[]> {
    if (environment.useMocks) {
      return this.version$.pipe(switchMap(() => mockResponse([...this.members])));
    }
    return this.http.get<Member[]>(`${environment.apiBaseUrl}/members`);
  }

  getMemberById(id: string): Observable<MemberDetail> {
    return this.getById(id);
  }

  getById(id: string): Observable<MemberDetail> {
    if (environment.useMocks) {
      return this.version$.pipe(
        switchMap(() => {
          const member = this.members.find((item) => item.id === id);
          if (!member) {
            return throwError(() => ({
              status: 404,
              message: 'Socio no encontrado',
              code: 'MEMBER_NOT_FOUND',
            }));
          }
          return mockResponse(this.toDetail(member));
        }),
      );
    }
    return this.http.get<MemberDetail>(`${environment.apiBaseUrl}/members/${id}`);
  }

  createMember(payload: CreateMemberRequest): Observable<Member> {
    return this.create(payload);
  }

  create(payload: CreateMemberRequest): Observable<Member> {
    if (environment.useMocks) {
      const nextNumber = this.nextMemberNumber();
      const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();
      const created: Member = {
        id: `mem-${String(nextNumber).padStart(3, '0')}`,
        memberCode: `S-${String(nextNumber).padStart(4, '0')}`,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        fullName,
        email: payload.email.trim(),
        documentNumber: payload.documentNumber.trim(),
        phone: payload.phone.trim(),
        category: payload.category,
        feeStatus: FeeStatus.Pendiente,
        monthlyFee: PLAN_FEES[payload.category],
        nextDueDate: this.defaultNextDueDate(),
        address: payload.address.trim(),
        birthDate: payload.birthDate,
        joinDate: new Date().toISOString().slice(0, 10),
        isActive: payload.isActive,
        qrToken: `QR-S${String(nextNumber).padStart(4, '0')}-VALID`,
      };
      this.members = [...this.members, created];
      this.bump();
      return mockResponse(created);
    }
    return this.http.post<Member>(`${environment.apiBaseUrl}/members`, payload);
  }

  updateMember(id: string, payload: UpdateMemberRequest): Observable<Member> {
    return this.update(id, payload);
  }

  update(id: string, payload: UpdateMemberRequest): Observable<Member> {
    if (environment.useMocks) {
      const index = this.members.findIndex((item) => item.id === id);
      if (index < 0) {
        return throwError(() => ({
          status: 404,
          message: 'Socio no encontrado',
          code: 'MEMBER_NOT_FOUND',
        }));
      }

      const current = this.members[index];
      const fullName =
        payload.fullName?.trim() ||
        (payload.firstName || payload.lastName
          ? `${payload.firstName ?? current.firstName} ${payload.lastName ?? current.lastName}`.trim()
          : current.fullName);

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = payload.firstName?.trim() || nameParts[0] || current.firstName;
      const lastName =
        payload.lastName?.trim() ||
        (nameParts.length > 1 ? nameParts.slice(1).join(' ') : current.lastName);

      const category = payload.category ?? current.category;
      const updated: Member = {
        ...current,
        ...payload,
        firstName,
        lastName,
        fullName,
        category,
        monthlyFee: payload.monthlyFee ?? PLAN_FEES[category],
      };
      this.members = this.members.map((item, i) => (i === index ? updated : item));
      this.bump();
      return mockResponse(updated);
    }
    return this.http.put<Member>(`${environment.apiBaseUrl}/members/${id}`, payload);
  }

  deactivateMember(id: string): Observable<Member> {
    return this.update(id, { isActive: false });
  }

  searchMembers(term: string): Observable<Member[]> {
    return this.search(term);
  }

  search(term: string): Observable<Member[]> {
    if (environment.useMocks) {
      const normalized = term.trim().toLowerCase();
      const results = this.members.filter(
        (member) =>
          member.fullName.toLowerCase().includes(normalized) ||
          member.firstName.toLowerCase().includes(normalized) ||
          member.lastName.toLowerCase().includes(normalized) ||
          member.email.toLowerCase().includes(normalized) ||
          member.memberCode.toLowerCase().includes(normalized) ||
          member.documentNumber.includes(normalized),
      );
      return mockResponse(results);
    }
    return this.http.get<Member[]>(`${environment.apiBaseUrl}/members`, {
      params: { q: term },
    });
  }

  filterMembers(predicate: (member: Member) => boolean): Observable<Member[]> {
    return this.list().pipe(map((members) => members.filter(predicate)));
  }

  getByMemberCode(memberCode: string): Observable<Member | undefined> {
    return this.list().pipe(
      map((members) => members.find((member) => member.memberCode === memberCode)),
    );
  }

  private toDetail(member: Member): MemberDetail {
    const pendingAmount =
      member.feeStatus === FeeStatus.AlDia
        ? 0
        : member.feeStatus === FeeStatus.Pendiente
          ? member.monthlyFee
          : member.monthlyFee * 2;

    const lastPaymentDate =
      member.feeStatus === FeeStatus.AlDia
        ? this.shiftMonths(member.nextDueDate, -1)
        : member.feeStatus === FeeStatus.Pendiente
          ? this.shiftMonths(member.nextDueDate, -2)
          : this.shiftMonths(member.nextDueDate, -3);

    return {
      ...member,
      lastPaymentDate,
      pendingAmount,
      account: {
        monthlyFee: member.monthlyFee,
        nextDueDate: member.nextDueDate,
        pendingAmount,
        lastPaymentDate,
      },
    };
  }

  private nextMemberNumber(): number {
    const max = this.members.reduce((acc, member) => {
      const match = /^S-(\d+)$/.exec(member.memberCode);
      const value = match ? Number(match[1]) : 0;
      return Math.max(acc, value);
    }, 0);
    return max + 1;
  }

  private defaultNextDueDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(9);
    return date.toISOString().slice(0, 10);
  }

  private shiftMonths(isoDate: string, months: number): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setMonth(date.getMonth() + months);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private bump(): void {
    this.version$.next(this.version$.value + 1);
  }
}
