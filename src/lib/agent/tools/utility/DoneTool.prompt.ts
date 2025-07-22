export const DONE_TOOL_PROMPT = `The 'done' tool should be used when:
- You have successfully completed the user's task
- All requested operations have been performed
- The final result is ready to be returned

Parameters:
- result: The final output/result of the task (can be any type)
- summary: (optional) A brief summary of what was accomplished

Examples:
- Task: "Extract the title from example.com"
  Use: done({ result: "Example Domain", summary: "Successfully extracted page title" })
  
- Task: "Fill out the contact form"
  Use: done({ result: { success: true, formId: "contact-123" }, summary: "Contact form submitted successfully" })

IMPORTANT: Only use this tool when the task is FULLY complete.`