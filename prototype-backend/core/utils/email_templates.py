LOGO_URL = "https://starleaders.s3.amazonaws.com/media/group_logos/cosmic-global-tech-logo-.jpeg"
MAIL_BG_COLOR = "#ffffff"
BUTTON_COLOR = "#16191C"


def create_mail_header(title):
    return f"""
    <head>
    <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
    <title>{title}</title>
    <meta name="description" content="{title}" />
    </head>
    """


def create_button(link, text):
    return f"""
    <a
      href={link}
      style="
        display: inline-block;
        background-color: {BUTTON_COLOR};
        color: #fff;
        border: none;
        padding: 10px 24px;
        font-size: 14px;
        line-height: 24px;
        text-align: justify;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        text-decoration: none;
      "
      >
      {text}
      </a>
    """


def create_greetings(name):
    return f"""
    <p
        style="
        color: #455056;
        font-size: 24px;
        line-height: 24px;
        margin: 0 0 16px 0;
        font-weight: bold;
        "
    >
        Dear {name},
    </p>
    """


def create_paragraph(
    text, text_align="left", font_size=14, margin=(0, 0, 0, 0), font_weight="normal"
):
    return f"""
    <p style="
        color: #455056;
        font-size: {font_size}px;
        line-height: 24px;
        text-align: {text_align};
        margin: {margin[0]}px {margin[1]}px {margin[2]}px {margin[3]}px;
        font-weight: {font_weight};
    ">
        {text}
    </p>
    """


def create_mail_body(*args):
    return f"""
      <body
        font-family="Inter, sans-serif"
        marginheight="0"
        topmargin="0"
        marginwidth="0"
        style="margin: 0px; background-color: {MAIL_BG_COLOR};"
        leftmargin="0"
      >
        <table
          cellspacing="0"
          border="0"
          cellpadding="0"
          width="100%"
          bgcolor="{MAIL_BG_COLOR}"
          style="
            @import url(https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap);
            font-family: 'Inter', sans-serif;
          "
        >
          <tr>
            <td>
              <table
                style="background-color: {MAIL_BG_COLOR}; max-width: 670px;\
                margin: 0 auto"
                width="100%"
                border="0"
                align="center"
                cellpadding="0"
                cellspacing="0"
              >
                <tr>
                  <td style="height: 80px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="text-align: center">
                    <a href="#" title="logo" target="_blank">
                      <img
                        width="250"
                        src="{LOGO_URL}"
                        title="logo"
                        alt="logo"
                      />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="height: 20px">&nbsp;</td>
                </tr>
                <tr>
                  <td>
                    <table
                      width="95%"
                      border="0"
                      border-radius="16px";
                      align="center"
                      cellpadding="0"
                      cellspacing="0"
                      style="
                        border-radius: 16px;
                        max-width: 670px;
                        background: #fff;
                        text-align: center;
                        -webkit-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        -moz-box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                        box-shadow: 0 6px 18px 0 rgba(0, 0, 0, 0.06);
                      "
                    >
                      <tr>
                        <td style="height: 40px">&nbsp;</td>
                      </tr>
                      <tr>
                        <td style="padding: 0 35px">
                      {"".join(args)}
                        </td>
                      </tr>
                      <tr>
                        <td style="height: 40px">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                    <td style="height: 20px">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="text-align: center">
                      <p style="
                        font-size: 14px;
                        color: rgba(69, 80, 86, 0.7411764705882353);
                        line-height: 18px;
                        margin: 0 0 0;
                      ">
                        &copy; <strong>Cosmic Global Technologies Team</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="height: 80px">&nbsp;</td>
                  </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    """


def create_contact_us_email_to_admin_template(name, email, message, type_):
    return create_mail_header("Contact Us Email") + create_mail_body(
        create_greetings("Admin"),
        create_paragraph(
            f"You have received a new message for {type_} on Cosmic Global Technologies.",
        ),
        create_paragraph("Name", font_weight="bold") + create_paragraph(name),
        create_paragraph("Email", font_weight="bold") + create_paragraph(email),  # noqa
        create_paragraph("Message", font_weight="bold")
        + create_paragraph(message),  # noqa
        create_paragraph("Thank you!"),
    )
