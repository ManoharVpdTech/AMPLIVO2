/**
 * Local ESLint rule: ban `dangerouslySetInnerHTML` unless it's used on a
 * `<style>` element.
 *
 * React's `dangerouslySetInnerHTML` is a stored/reflected-XSS vector when fed
 * user-controllable content. This project only uses it for injecting static
 * CSS into `<style>` tags, which is safe because the CSS block contains no
 * user-controlled data. The rule enforces that invariant going forward.
 */
export const noDangerousHtmlRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid dangerouslySetInnerHTML except on <style> elements (XSS guard)",
    },
    messages: {
      forbidden:
        "Avoid dangerouslySetInnerHTML. Only <style> may carry static __html; anything else can inject attacker HTML.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== "dangerouslySetInnerHTML") {
          return;
        }
        const openingElement = node.parent;
        if (
          openingElement &&
          openingElement.name &&
          openingElement.name.name === "style"
        ) {
          return;
        }
        context.report({ node, messageId: "forbidden" });
      },
    };
  },
};