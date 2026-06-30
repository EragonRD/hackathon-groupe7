import { Injectable, Logger } from '@nestjs/common'

// 📧 Envoi d'email. Pour le hackathon : on SIMULE l'envoi (log + journal en mémoire)
// et l'invitation est aussi renvoyée à l'appelant. En prod : brancher un vrai SMTP
// / une API (SendGrid, SES…) ici, sans changer les appelants.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly sent: Array<{ to: string; subject: string; at: number }> = []

  async sendAdminInvite(input: {
    to: string
    companyName: string
    link: string
    tempPassword: string
    expiresAt: number
  }): Promise<void> {
    const expire = new Date(input.expiresAt).toISOString()
    const subject = `Invitation administrateur — ${input.companyName}`
    this.logger.log(
      `EMAIL -> ${input.to} | ${subject} | lien=${input.link} | mdp_temporaire=${input.tempPassword} | expire=${expire}`,
    )
    this.sent.push({ to: input.to, subject, at: input.expiresAt })
    await Promise.resolve()
  }
}
