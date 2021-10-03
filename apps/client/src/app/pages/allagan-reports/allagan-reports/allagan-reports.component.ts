import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { AllaganReportsService } from '../allagan-reports.service';
import { environment } from '../../../../environments/environment';
import { NzModalService } from 'ng-zorro-antd/modal';
import { TranslateService } from '@ngx-translate/core';
import { SheetImportPopupComponent } from '../sheet-import-popup/sheet-import-popup.component';
import { filter, map } from 'rxjs/operators';
import { LazyDataService } from '../../../core/data/lazy-data.service';
import { combineLatest } from 'rxjs';
import { AuthFacade } from '../../../+state/auth.facade';
import { AllaganReportQueueEntry } from '../model/allagan-report-queue-entry';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AllaganReportStatus } from '../model/allagan-report-status';
import { AllaganReportSource } from '../model/allagan-report-source';

@Component({
  selector: 'app-allagan-reports',
  templateUrl: './allagan-reports.component.html',
  styleUrls: ['./allagan-reports.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AllaganReportsComponent {

  AllaganReportStatus = AllaganReportStatus;
  AllaganReportSource = AllaganReportSource;

  public applyingChange = false;

  public dirty = false;
  public selectCount = 0;

  public devEnv = !environment.production;

  public queueStatus$ = this.allaganReportsService.getQueueStatus().pipe(
    filter(() => !this.dirty),
    map(rows => {
      return rows.map(row => {
        return {
          ...row,
          selected: false
        };
      });
    })
  );

  public status$ = combineLatest([this.lazyData.extracts$, this.allaganReportsService.getDashboardData()]).pipe(
    map(([extracts, dashboardData]) => {
      const fishWithNoData = this.lazyData.data.fishes
        .filter(itemId => {
          return !dashboardData.itemIds.includes(itemId)
            && !this.lazyData.data.items[itemId].en.includes('Skybuilders');
        });
      return {
        reportsCount: dashboardData.reportsCount,
        appliedReportsCount: dashboardData.appliedReportsCount,
        fishCoverage: Math.floor(1000 * (this.lazyData.data.fishes.length - fishWithNoData.length) / this.lazyData.data.fishes.length) / 10,
        fishWithNoData,
        itemsWithNoSource: Object.values(extracts).filter(e => {
          const name = this.lazyData.data.items[e.id].en;
          return !['Dated', 'Skybuilders'].some(ignored => name.indexOf(ignored) > -1)
            && e.sources.length === 0 && !dashboardData.itemIds.includes(e.id);
        }).map(e => e.id).sort((a, b) => b - a)
      };
    })
  );

  isDataChecker$ = this.authFacade.user$.pipe(map(user => user.admin || user.moderator || user.allaganChecker));

  constructor(public allaganReportsService: AllaganReportsService,
              private dialog: NzModalService, public translate: TranslateService,
              private lazyData: LazyDataService, private authFacade: AuthFacade,
              private message: NzMessageService, private cd: ChangeDetectorRef) {
  }

  public onRowChecked($event: boolean): void {
    this.dirty = true;
    if ($event) {
      this.selectCount++;
    } else {
      this.selectCount--;
    }
  }

  public handleCheckboxClick($event: MouseEvent, rows: AllaganReportQueueEntry[], index: number): void {
    if ($event.shiftKey) {
      const slice = rows.slice(0, index).reverse();
      for (const row of slice) {
        if (row.selected) {
          break;
        }
        if (row.type === AllaganReportStatus.PROPOSAL && row.source !== AllaganReportSource.FISHING && row.source !== AllaganReportSource.SPEARFISHING) {
          row.selected = true;
          this.selectCount++;
        }
      }
      this.cd.detectChanges();
    }
  }

  getColor(status: AllaganReportStatus): string {
    switch (status) {
      case AllaganReportStatus.ACCEPTED:
        return 'darkgreen';
      case AllaganReportStatus.DELETION:
        return '#f50';
      case AllaganReportStatus.MODIFICATION:
        return '#f2b10e';
      case AllaganReportStatus.PROPOSAL:
        return '#108ee9';
    }
  }

  importSheet(): void {
    this.dialog.create({
      nzContent: SheetImportPopupComponent,
      nzComponentParams: {},
      nzFooter: null,
      nzTitle: this.translate.instant('CUSTOM_ITEMS.Import_items')
    });
  }

  acceptProposal(entry: AllaganReportQueueEntry): void {
    this.dirty = false;
    this.allaganReportsService.acceptProposal(entry).subscribe(() => {
      this.message.success(this.translate.instant('ALLAGAN_REPORTS.Proposal_accepted'));
      this.applyingChange = false;
      this.cd.detectChanges();
    });
  }

  rejectProposal(entry: AllaganReportQueueEntry): void {
    this.dirty = false;
    this.allaganReportsService.reject(entry).subscribe(() => {
      this.message.success(this.translate.instant('ALLAGAN_REPORTS.Proposal_rejected'));
      this.applyingChange = false;
      this.cd.detectChanges();
    });
  }

  acceptMany(entries: AllaganReportQueueEntry[]): void {
    this.dirty = false;
    this.allaganReportsService.acceptManyProposal(entries.filter(e => e.selected).map(e => {
      delete e.selected;
      return e;
    })).subscribe(() => {
      this.message.success(this.translate.instant('ALLAGAN_REPORTS.Proposal_accepted'));
      this.applyingChange = false;
      this.selectCount = 0;
      this.cd.detectChanges();
    });
  }

  rejectMany(entries: AllaganReportQueueEntry[]): void {
    this.dirty = false;
    this.allaganReportsService.rejectMany(entries.filter(e => e.selected).map(e => {
      delete e.selected;
      return e;
    })).subscribe(() => {
      this.message.success(this.translate.instant('ALLAGAN_REPORTS.Proposal_rejected'));
      this.applyingChange = false;
      this.selectCount = 0;
      this.cd.detectChanges();
    });
  }
}