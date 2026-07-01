import { Injectable, Logger } from '@nestjs/common'

const MAILJET_ENDPOINT = 'https://api.mailjet.com/v3.1/send'

// Échappe les valeurs interpolées dans le HTML de l'email (anti-injection/phishing).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailDelivery {
  delivered: boolean
  provider: 'mailjet' | 'simulated'
}

// 📧 Envoi d'email via Mailjet (API REST v3.1). Clés en variables d'environnement.
// Si les clés ne sont pas configurées, on RETOMBE en simulation (log) afin que la
// démo et les tests fonctionnent sans compte Mailjet.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly apiKey = process.env.MAILJET_API_KEY
  private readonly secretKey = process.env.MAILJET_SECRET_KEY
  private readonly fromEmail = process.env.MAILJET_FROM_EMAIL
  private readonly fromName = process.env.MAILJET_FROM_NAME ?? 'Plateforme Vidéo'
  // Mode bac à sable Mailjet : valide l'appel API sans réellement délivrer le mail.
  private readonly sandbox = process.env.MAILJET_SANDBOX === 'true'

  private get configured(): boolean {
    return Boolean(this.apiKey && this.secretKey && this.fromEmail)
  }

  async sendAdminInvite(input: {
    to: string
    companyName: string
    link: string
    tempPassword: string
    expiresAt: number
  }): Promise<EmailDelivery> {
    const subject = `Invitation administrateur — ${input.companyName}`
    const expire = new Date(input.expiresAt).toLocaleString('fr-FR')
    const text =
      `Bonjour,\n\nVous êtes invité comme administrateur de « ${input.companyName} ».\n` +
      `Connectez-vous ici : ${input.link}\n` +
      `Mot de passe temporaire : ${input.tempPassword}\n` +
      `Valable jusqu'au ${expire}. Vous devrez le changer à la première connexion.\n`
    const html =
      `<p>Bonjour,</p><p>Vous êtes invité comme <b>administrateur</b> de ` +
      `« ${escapeHtml(input.companyName)} ».</p>` +
      `<p><a href="${escapeHtml(input.link)}">Se connecter</a></p>` +
      `<p>Mot de passe temporaire : <b>${escapeHtml(input.tempPassword)}</b><br>` +
      `Valable jusqu'au ${escapeHtml(expire)}. À changer à la première connexion.</p>`

    // Pas de clés → simulation (log + retour à l'appelant via la réponse HTTP).
    if (!this.configured) {
      this.logger.warn(
        `[email simulé] -> ${input.to} | ${subject} | lien=${input.link} | ` +
          `mdp_temporaire=${input.tempPassword} | expire=${expire}`,
      )
      return { delivered: false, provider: 'simulated' }
    }

    try {
      const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64')
      const res = await fetch(MAILJET_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          SandboxMode: this.sandbox,
          Messages: [
            {
              From: { Email: this.fromEmail, Name: this.fromName },
              To: [{ Email: input.to }],
              Subject: subject,
              TextPart: text,
              HTMLPart: html,
            },
          ],
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        this.logger.error(`Mailjet a refusé l'envoi (${res.status}) : ${body}`)
        return { delivered: false, provider: 'mailjet' }
      }
      this.logger.log(
        `Invitation envoyée via Mailjet à ${input.to}${this.sandbox ? ' (sandbox)' : ''}`,
      )
      return { delivered: true, provider: 'mailjet' }
    } catch (error) {
      this.logger.error(`Échec d'envoi Mailjet : ${(error as Error).message}`)
      return { delivered: false, provider: 'mailjet' }
    }
  }
}
