import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger("thriftloop.email")


class EmailDeliveryError(Exception):
    pass


def _build_message(to_email: str, username: str, code: str) -> EmailMessage:
    minutes = settings.otp_expire_minutes
    msg = EmailMessage()
    msg["Subject"] = f"{code} is your ThriftLoop verification code"
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_username))
    msg["To"] = to_email
    msg.set_content(
        f"Hi {username},\n\n"
        f"Your ThriftLoop verification code is: {code}\n\n"
        f"It expires in {minutes} minutes and can only be used once.\n"
        "If you didn't create a ThriftLoop account, you can ignore this email.\n\n"
        "— ThriftLoop"
    )
    msg.add_alternative(
        f"""\
<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#F8F8F6;padding:32px">
  <div style="max-width:440px;margin:auto;background:#fff;border-radius:16px;padding:32px">
    <h2 style="color:#183D32;margin:0 0 8px">ThriftLoop</h2>
    <p style="color:#202522">Hi {username}, here is your verification code:</p>
    <p style="font-size:34px;letter-spacing:10px;font-weight:700;color:#183D32;margin:24px 0">{code}</p>
    <p style="color:#858B86;font-size:14px">It expires in {minutes} minutes and can only be used once.
    If you didn't create a ThriftLoop account, you can ignore this email.</p>
  </div>
</div>""",
        subtype="html",
    )
    return msg


def send_verification_email(to_email: str, username: str, code: str) -> None:
    """Send the OTP through Gmail SMTP (STARTTLS on 587).

    Without SMTP credentials (or with EMAIL_DEV_MODE=true) the code is printed to the
    server console so the flow can still be demoed locally. It is never returned to the client.
    """
    if settings.email_dev_mode or not settings.smtp_configured:
        print(f"\n[DEV EMAIL] Verification code for {to_email}: {code}\n", flush=True)
        return

    msg = _build_message(to_email, username, code)
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception("Failed to send verification email to %s", to_email)
        raise EmailDeliveryError("We couldn't send the verification email. Please try again.") from exc
