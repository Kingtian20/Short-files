      function formatCode(cm) {
        const mode = cm.getOption("mode");
        let parser = "html";
        if (mode === "css") parser = "css";
        if (mode === "javascript") parser = "babel";

        try {
          const formatted = prettier.format(cm.getValue(), {
            parser: parser,
            plugins: prettierPlugins,
            tabWidth: 2,
          });
          cm.setValue(formatted);
        } catch (e) {
          console.error("Format error: ", e);
        }
      }

      function formatActiveEditor() {
        const activeTab = document.querySelector(".tab.active");
        if (activeTab && activeTab.dataset.cm) {
          formatCode(editors[activeTab.dataset.cm]);
        }
      }

      const editorConfig = {
        theme: "dracula",
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        extraKeys: {
          "Ctrl-Space": "autocomplete",
          "Alt-Shift-F": function (cm) {
            formatCode(cm);
          },
        },
      };

      const editors = {
        htmlEditor: CodeMirror.fromTextArea(
          document.getElementById("htmlEditor"),
          { ...editorConfig, mode: "htmlmixed" }
        ),
        cssEditor: CodeMirror.fromTextArea(
          document.getElementById("cssEditor"),
          { ...editorConfig, mode: "css" }
        ),
        jsEditor: CodeMirror.fromTextArea(document.getElementById("jsEditor"), {
          ...editorConfig,
          mode: "javascript",
        }),
      };

      editors.htmlEditor.addOverlay({
        token: function (stream) {
          if (stream.match("<") || stream.match(">") || stream.match("/"))
            return "bracket-gray";
          while (
            stream.next() != null &&
            !stream.match("<", false) &&
            !stream.match(">", false) &&
            !stream.match("/", false)
          ) {}
          return null;
        },
      });

      const HTML_TAGS = [
        "a",
        "abbr",
        "address",
        "area",
        "article",
        "aside",
        "audio",
        "b",
        "base",
        "bdi",
        "bdo",
        "blockquote",
        "body",
        "br",
        "button",
        "canvas",
        "caption",
        "cite",
        "code",
        "col",
        "colgroup",
        "data",
        "datalist",
        "dd",
        "del",
        "details",
        "dfn",
        "dialog",
        "div",
        "dl",
        "dt",
        "em",
        "embed",
        "fieldset",
        "figcaption",
        "figure",
        "footer",
        "form",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "head",
        "header",
        "hr",
        "html",
        "i",
        "iframe",
        "img",
        "input",
        "ins",
        "kbd",
        "label",
        "legend",
        "li",
        "link",
        "main",
        "map",
        "mark",
        "meta",
        "meter",
        "nav",
        "noscript",
        "object",
        "ol",
        "optgroup",
        "option",
        "output",
        "p",
        "param",
        "picture",
        "pre",
        "progress",
        "q",
        "rp",
        "rt",
        "ruby",
        "s",
        "samp",
        "script",
        "section",
        "select",
        "small",
        "source",
        "span",
        "strong",
        "style",
        "sub",
        "summary",
        "sup",
        "table",
        "tbody",
        "td",
        "template",
        "textarea",
        "tfoot",
        "th",
        "thead",
        "time",
        "title",
        "tr",
        "track",
        "u",
        "ul",
        "var",
        "video",
        "wbr",
      ];

      Object.keys(editors).forEach((key) => {
        const editor = editors[key];
        if (key !== "jsEditor" && typeof emmetCodeMirror === "function")
          emmetCodeMirror(editor);

        editor.on("inputRead", function (cm, change) {
          if (change.origin !== "+input" || /[\s;]/.test(change.text[0]))
            return;

          const cursor = cm.getCursor();
          const token = cm.getTokenAt(cursor);
          let hintOptions = { completeSingle: false, container: document.body };

          if (key === "htmlEditor") {
            const line = cm.getLine(cursor.line);
            const before = line.slice(0, cursor.ch);

            if (
              !before.includes("<") ||
              before.lastIndexOf(">") > before.lastIndexOf("<")
            ) {
              hintOptions.hint = (cmInstance) => {
                const cur = cmInstance.getCursor();
                const tok = cmInstance.getTokenAt(cur);
                const searchRaw = tok.string;

                if (searchRaw === "!" || searchRaw === "!!!") {
                  return {
                    list: [searchRaw],
                    from: CodeMirror.Pos(cur.line, tok.start),
                    to: CodeMirror.Pos(cur.line, tok.end),
                  };
                }

                const search = searchRaw.toLowerCase().replace(/[^\w]/g, "");
                const list = HTML_TAGS.filter((t) => t.includes(search)).sort(
                  (a, b) => {
                    if (a.startsWith(search) && !b.startsWith(search))
                      return -1;
                    if (!a.startsWith(search) && b.startsWith(search)) return 1;
                    return a.localeCompare(b);
                  }
                );

                return {
                  list: list,
                  from: CodeMirror.Pos(cur.line, tok.start),
                  to: CodeMirror.Pos(cur.line, tok.end),
                };
              };
            }
          }
          cm.showHint(hintOptions);
        });
      });

      function clearConsole() {
        document.getElementById("consoleOutput").innerHTML = "";
      }

      function runCode() {
        const html = editors.htmlEditor.getValue();
        const css = `<style>${editors.cssEditor.getValue()}</style>`;
        const js = editors.jsEditor.getValue();
        let transpiledJS = "";
        try {
          transpiledJS = Babel.transform(js, { presets: ["env"] }).code;
        } catch (e) {
          transpiledJS = js;
        }

        const scriptInject = `<script>
                    const send = (type, msg) => parent.postMessage({type, msg}, '*');
                    console.log = (...args) => send('log', args.join(' '));
                    console.error = (...args) => send('error', args.join(' '));
                    window.onerror = (m, s, l) => send('error', m + " (Line: " + l + ")");
                    try { ${transpiledJS} } catch (e) { send('error', e.message); }
                <\/script>`;
        document.getElementById("output").srcdoc = html + css + scriptInject;
      }

      document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          document
            .querySelectorAll(".tab, .editor-layer")
            .forEach((el) => el.classList.remove("active"));
          tab.classList.add("active");
          document.getElementById(tab.dataset.target).classList.add("active");
          if (tab.dataset.cm) editors[tab.dataset.cm].refresh();
        });
      });

      const dragbar = document.getElementById("dragbar");
      const panel = document.querySelector(".editor-panel");
      let isResizing = false;
      dragbar.addEventListener("mousedown", () => {
        isResizing = true;
        document
          .querySelectorAll("iframe")
          .forEach((f) => (f.style.pointerEvents = "none"));
      });
      document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;
        panel.style.width = e.clientX + "px";
      });
      document.addEventListener("mouseup", () => {
        isResizing = false;
        document
          .querySelectorAll("iframe")
          .forEach((f) => (f.style.pointerEvents = "auto"));
        Object.values(editors).forEach((ed) => ed.refresh());
      });

      window.addEventListener("message", (e) => {
        if (e.data.type) {
          const out = document.getElementById("consoleOutput");
          const div = document.createElement("div");
          div.className = e.data.type;
          div.textContent = `> ${e.data.msg}`;
          out.appendChild(div);
          out.scrollTop = out.scrollHeight;
        }
      });

      runCode();
