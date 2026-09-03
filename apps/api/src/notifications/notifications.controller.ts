import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { AuthGuard, CurrentUser, type JwtUser } from "../auth/auth.guard";

@Controller("notifications") @UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get("available") disp(@CurrentUser() u: JwtUser) { return this.svc.disponibili(u.sub); }
  @Post("seen") viste(@CurrentUser() u: JwtUser) { return this.svc.segnaViste(u.sub); }
}
