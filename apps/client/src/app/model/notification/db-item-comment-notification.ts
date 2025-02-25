import { AbstractNotification } from '../../core/notification/abstract-notification';
import { TranslateService } from '@ngx-translate/core';
import { I18nToolsService } from '../../core/tools/i18n-tools.service';
import { NotificationType } from '../../core/notification/notification-type';
import { Observable } from 'rxjs';

export class DbItemCommentNotification extends AbstractNotification {

  constructor(private comment: string, private pageLink: string, target: string) {
    super(NotificationType.DB_ITEM_COMMENT, target);
  }

  getContent(translate: TranslateService, i18nTools: I18nToolsService): Observable<string> {
    return translate.get('NOTIFICATIONS.Db_comment', {
      comment: this.comment
    });
  }

  getIcon(): string {
    return 'message';
  }

  getTargetRoute(): string[] {
    return [`/db/en/${this.pageLink}`];
  }

}
