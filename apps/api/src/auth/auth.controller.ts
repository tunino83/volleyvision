import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ZodPipe } from "../common/zod.pipe";
import { CambioPasswordInput, LoginInput, ProfiloInput, RegisterInput,
         Email, Password } from "@vv/schema";
import { z } from "zod";
import { AuthGuard, CurrentUser, type JwtUser } from "./auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  register(@Body(new ZodPipe(RegisterInput)) dto: RegisterInput) { return this.auth.register(dto); }

  @Post("verify-email")
  verify(@Body(new ZodPipe(z.object({ token: z.string() }))) b: { token: string }) {
    return this.auth.verificaEmail(b.token);
  }

  @Post("login")
  login(@Body(new ZodPipe(LoginInput)) dto: LoginInput) { return this.auth.login(dto); }

  @Post("refresh")
  refresh(@Body(new ZodPipe(z.object({ refresh: z.string() }))) b: { refresh: string }) {
    return this.auth.refresh(b.refresh);
  }

  @Post("logout") @UseGuards(AuthGuard)
  logout(@CurrentUser() u: JwtUser) { return this.auth.logout(u.sub); }

  @Post("password/forgot")
  forgot(@Body(new ZodPipe(z.object({ email: Email }))) b: { email: string }) {
    return this.auth.richiediReset(b.email);
  }

  @Post("password/reset")
  reset(@Body(new ZodPipe(z.object({ token: z.string(), password: Password }))) b: { token: string; password: string }) {
    return this.auth.eseguiReset(b.token, b.password);
  }

  @Get("me") @UseGuards(AuthGuard)
  me(@CurrentUser() u: JwtUser) { return this.auth.me(u.sub); }

  @Patch("me") @UseGuards(AuthGuard)
  profilo(@CurrentUser() u: JwtUser,
          @Body(new ZodPipe(ProfiloInput)) d: ProfiloInput) {
    return this.auth.aggiornaProfilo(u.sub, d.nome, d.cognome);
  }

  @Post("password/change") @UseGuards(AuthGuard)
  cambia(@CurrentUser() u: JwtUser,
         @Body(new ZodPipe(CambioPasswordInput)) d: CambioPasswordInput) {
    return this.auth.cambiaPassword(u.sub, d.attuale, d.nuova);
  }

  /** Modi di accesso collegati. Nessun segreto: solo quali e da quando. */
  @Delete("identita/:id") @UseGuards(AuthGuard)
  scollega(@CurrentUser() u: JwtUser, @Param("id") id: string) {
    return this.auth.scollegaIdentita(u.sub, id);
  }
}
