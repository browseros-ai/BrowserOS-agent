---
name: fill-form
description: Intelligently fill web forms using provided data — handles text fields, dropdowns, checkboxes, radio buttons, and multi-step forms. Use when the user asks to fill out, complete, or submit a form.
metadata:
  display-name: Fill Form
  enabled: "true"
  version: "1.0"
---

# Fill Form

## When to Use

Activate when the user asks to fill out a form, complete an application, enter data into fields, or submit information on a web page.

## Steps

1. **Collect the data to fill.** Ask the user for the information if not already provided. Organize it as key-value pairs.

2. **Take a snapshot** using `take_snapshot` to see the form fields and understand the layout.

3. **Map data to fields.** Match the user's data keys to form field labels. Handle common variations:
   - "Name" may map to "Full Name", "Your Name", or separate "First Name" + "Last Name" fields
   - "Phone" may map to "Phone Number", "Mobile", "Tel"
   - "Address" may need to split into Street, City, State, Zip

4. **Fill fields in order.** For each field:
   - **Text inputs:** Use `fill` with the field selector and value
   - **Dropdowns/selects:** Use `select_option` with the appropriate value
   - **Checkboxes:** Use `check` to toggle on/off
   - **Radio buttons:** Use `click` on the correct option
   - **Date pickers:** Try `fill` first; if that fails, interact with the date picker UI using `click`
   - **File uploads:** Use `upload_file` for attachment fields

5. **Handle multi-step forms.** After filling visible fields:
   - Look for "Next", "Continue", or "Step 2" buttons
   - Use `click` to advance
   - Take a new snapshot to see the next step's fields
   - Repeat the fill process

6. **Review before submission.** Take a final `take_snapshot` and present the filled form to the user for confirmation before clicking Submit.

## Tips

- Fill fields top-to-bottom, left-to-right to match natural tab order.
- For auto-complete fields (like address), type slowly and wait for suggestions to appear, then select.
- If a field has validation errors after filling, read the error message and adjust the value.
- Never submit payment forms without explicit user confirmation.
- For CAPTCHA fields, inform the user they need to complete it manually.
