import { Component } from '@angular/core';
import { UserService } from '../../../core/database/user.service';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { XivapiService } from '@xivapi/angular-client';
import { TeamcraftUser } from '../../../model/user/teamcraft-user';
import { debounceTime, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { UntypedFormControl, Validators } from '@angular/forms';
import { UserSearchMode } from './user-search-mode.enum';
import { NzModalService } from 'ng-zorro-antd/modal';
import { TranslateService } from '@ngx-translate/core';
import { IntegrityCheckPopupComponent } from './integrity-check-popup/integrity-check-popup.component';
import { LodestoneService } from '../../../core/api/lodestone.service';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.less']
})
export class UsersComponent {

  userSearchModes = Object.values(UserSearchMode);

  UserSearchMode = UserSearchMode;

  searchMode: UserSearchMode = UserSearchMode.UID;

  uidFilter = new UntypedFormControl('');

  emailFilter = new UntypedFormControl('');

  servers$: Observable<string[]>;

  autoCompleteRows$: Observable<string[]>;

  selectedServer = new UntypedFormControl('', [Validators.required]);

  characterName = new UntypedFormControl('');

  lodestoneId = new UntypedFormControl(null);

  loadingResults = false;

  results$: Observable<TeamcraftUser[]>;

  constructor(private userService: UserService, private xivapi: XivapiService,
              private gcf: Functions, private modal: NzModalService,
              private translate: TranslateService, private lodestone: LodestoneService) {

    // From UID
    const usersFromUid$ = this.uidFilter.valueChanges.pipe(
      tap(() => this.loadingResults = true),
      switchMap(uid => {
        return this.userService.get(uid);
      }),
      map(user => [user].filter(u => !u.notFound)),
      tap(() => this.loadingResults = false)
    );

    // From Email
    const usersFromEmail$ = this.emailFilter.valueChanges.pipe(
      tap(() => this.loadingResults = true),
      switchMap(email => {
        return httpsCallable<{ email: string }, { record: User }>(this.gcf, 'getUserByEmail')({ email: email });
      }),
      switchMap(res => {
        if (!res?.data.record) {
          return of({ notFound: true });
        }
        return this.userService.get(res.data.record.uid);
      }),
      map(user => [user].filter(u => !u.notFound)),
      tap(() => this.loadingResults = false)
    );

    // From char name
    this.servers$ = this.xivapi.getServerList().pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.autoCompleteRows$ = combineLatest([this.servers$, this.selectedServer.valueChanges])
      .pipe(
        map(([servers, inputValue]) => {
          return servers.filter(server => server.toLowerCase().indexOf(inputValue.toLowerCase()) > -1);
        })
      );

    const usersFromCharName$ = combineLatest([this.selectedServer.valueChanges, this.characterName.valueChanges])
      .pipe(
        tap(() => this.loadingResults = true),
        debounceTime(500),
        switchMap(([selectedServer, characterName]) => {
          return this.lodestone.searchCharacter(characterName, selectedServer);
        }),
        switchMap(results => {
          if (results.length === 0) {
            return of([]);
          }
          return combineLatest(
            results.map(c => {
              return this.userService.getUsersByLodestoneId(c.ID);
            })
          ).pipe(
            map(res => {
              return [].concat.apply([], res);
            })
          );
        }),
        tap(() => this.loadingResults = false)
      );

    // From lodestone ID
    const usersFromLodestoneID$ = this.lodestoneId.valueChanges.pipe(
      tap(() => this.loadingResults = true),
      switchMap(lodestoneId => this.userService.getUsersByLodestoneId(lodestoneId)),
      tap(() => this.loadingResults = false)
    );

    this.results$ = merge(
      usersFromUid$,
      usersFromEmail$,
      usersFromCharName$,
      usersFromLodestoneID$
    );
  }

  runIntegrityCheck(user: TeamcraftUser): void {
    this.modal.create({
      nzTitle: this.translate.instant('ADMIN.USERS.Integrity_check'),
      nzContent: IntegrityCheckPopupComponent,
      nzFooter: null,
      nzComponentParams: {
        user: user
      }
    });
  }

}
