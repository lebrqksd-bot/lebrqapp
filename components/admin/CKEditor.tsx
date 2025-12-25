import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface CKEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  style?: any;
}

export default function CKEditor({ value, onChange, placeholder, style }: CKEditorProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const editorInstanceRef = useRef<any>(null);
  const editorInitializedRef = useRef(false);
  const isInternalChangeRef = useRef(false);
  const lastValueRef = useRef<string>(value || '');
  const editorContentRef = useRef<string>(value || '');
  const ignoreNextValueUpdateRef = useRef(false);
  const initialValueSetRef = useRef(false);

  // CKEditor HTML template for WebView (mobile) and iframe (web)
  const editorHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.ckeditor.com/ckeditor5/41.1.0/classic/ckeditor.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    #editor {
      min-height: 400px;
    }
    .ck-editor__editable {
      min-height: 400px;
    }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script>
    let editor;
    let isWebView = typeof window.ReactNativeWebView !== 'undefined';
    
    ClassicEditor
      .create(document.querySelector('#editor'), {
        toolbar: {
          items: [
            'heading', '|',
            'bold', 'italic', 'link', '|',
            'bulletedList', 'numberedList', '|',
            'outdent', 'indent', '|',
            'blockQuote', 'insertTable', '|',
            'undo', 'redo'
          ]
        },
        placeholder: '${placeholder || 'Enter content...'}',
      })
      .then(editorInstance => {
        editor = editorInstance;
        
        // Set initial content
        const initialContent = \`${(value || '').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\`;
        if (initialContent) {
          editor.setData(initialContent);
        }
        
        // Listen for changes - use debounce to prevent too many updates
        let changeTimeout;
        editor.model.document.on('change:data', () => {
          clearTimeout(changeTimeout);
          changeTimeout = setTimeout(() => {
            const data = editor.getData();
            // Store current editor content to compare later
            window._ckeditorCurrentContent = data;
            // Mark as internal change to prevent feedback loop
            window._ckeditorInternalChange = true;
            if (isWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'contentChange',
                data: data
              }));
            } else {
              // For iframe, use postMessage to parent window
              window.parent.postMessage({
                type: 'ckeditor-contentChange',
                data: data,
                timestamp: Date.now()
              }, '*');
            }
            // Keep flag set longer to prevent feedback loop
            setTimeout(() => {
              window._ckeditorInternalChange = false;
            }, 1000); // Keep flag for 1 second
          }, 300); // Debounce changes by 300ms to reduce update frequency
        });
        
        // Notify that editor is ready
        if (isWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'editorReady'
          }));
        } else {
          window.parent.postMessage({
            type: 'ckeditor-ready'
          }, '*');
        }
      })
      .catch(error => {
        console.error('CKEditor initialization error:', error);
        if (isWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        } else {
          window.parent.postMessage({
            type: 'ckeditor-error',
            error: error.message
          }, '*');
        }
      });
    
    // Listen for messages from parent/React Native
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'setContent' && editor) {
        // Only update if content is actually different to prevent unnecessary refreshes
        const currentData = editor.getData();
        const newData = event.data.content || '';
        if (currentData !== newData) {
          // Temporarily disable change tracking to prevent feedback loop
          window._ckeditorInternalChange = true;
          // Save current selection/cursor position if possible
          const selection = editor.model.document.selection;
          let selectionData = null;
          try {
            if (selection && selection.anchor) {
              selectionData = {
                anchor: selection.anchor.path,
                focus: selection.focus.path
              };
            }
          } catch (e) {
            // Selection might not be accessible
          }
          
          editor.setData(newData);
          // Update stored content
          window._ckeditorCurrentContent = newData;
          
          // Try to restore selection after a brief delay
          if (selectionData) {
            setTimeout(() => {
              try {
                editor.model.change(writer => {
                  const root = editor.model.document.getRoot();
                  const anchor = root.getNodeByPath(selectionData.anchor);
                  const focus = root.getNodeByPath(selectionData.focus);
                  if (anchor && focus) {
                    writer.setSelection(anchor, { backward: false });
                  }
                });
              } catch (e) {
                // Selection restoration failed, ignore
              }
            }, 50);
          }
          
          // Re-enable tracking after a delay
          setTimeout(() => {
            window._ckeditorInternalChange = false;
          }, 1000);
        }
      }
    });
  </script>
</body>
</html>
  `;

  // Web platform: iframe-based CKEditor
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleMessage = (event: MessageEvent) => {
        // Only process messages from our iframe
        if (event.source !== iframeRef.current?.contentWindow) {
          return;
        }

        if (event.data && event.data.type === 'ckeditor-contentChange') {
          const newContent = event.data.data;
          // Only update if content actually changed
          if (newContent !== editorContentRef.current) {
            // Set flag BEFORE calling onChange to prevent immediate feedback
            isInternalChangeRef.current = true;
            lastValueRef.current = newContent;
            editorContentRef.current = newContent;
            
            // Use setTimeout to defer onChange, allowing React to process the flag first
            setTimeout(() => {
              onChange(newContent);
              // Keep flag set longer to prevent feedback loop
              setTimeout(() => {
                isInternalChangeRef.current = false;
              }, 1000); // Increased to 1 second to be safe
            }, 0);
          }
        } else if (event.data && event.data.type === 'ckeditor-ready') {
          editorInitializedRef.current = true;
          // Editor is ready, set initial content if needed
          if (value && iframeRef.current?.contentWindow && !initialValueSetRef.current) {
            initialValueSetRef.current = true;
            lastValueRef.current = value;
            editorContentRef.current = value;
            ignoreNextValueUpdateRef.current = true;
            setTimeout(() => {
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                  type: 'setContent',
                  content: value
                }, '*');
                setTimeout(() => {
                  ignoreNextValueUpdateRef.current = false;
                }, 200);
              }
            }, 100);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Set up iframe load handler
      const setupIframe = () => {
        const iframe = iframeRef.current;
        if (iframe) {
          const handleLoad = () => {
            // Editor will send ready message, we'll handle it in handleMessage
          };

          if (iframe.contentDocument?.readyState === 'complete') {
            handleLoad();
          } else {
            iframe.addEventListener('load', handleLoad, { once: true });
          }
        } else {
          // Retry if iframe not ready yet
          setTimeout(setupIframe, 100);
        }
      };

      // Start setup after a short delay to ensure iframe is in DOM
      const timer = setTimeout(setupIframe, 200);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [onChange]);

  // Update editor content when value prop changes (web iframe)
  // Only update if the change is external (not from the editor itself)
  useEffect(() => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow && value !== undefined && editorInitializedRef.current) {
      // Skip if we're ignoring the next update (for initial load)
      if (ignoreNextValueUpdateRef.current) {
        return;
      }
      
      // Skip update if this change came from the editor itself
      if (isInternalChangeRef.current) {
        return;
      }
      
      // Check if iframe has the internal change flag set
      try {
        const iframeWindow = iframeRef.current.contentWindow as any;
        if (iframeWindow?._ckeditorInternalChange) {
          return;
        }
      } catch (e) {
        // Cross-origin or other error, continue
      }
      
      // Skip update if value matches what we last sent to editor
      if (value === lastValueRef.current) {
        return;
      }
      
      // Check if value matches current editor content (to avoid unnecessary updates)
      try {
        const iframeWindow = iframeRef.current.contentWindow as any;
        if (iframeWindow?._ckeditorCurrentContent === value) {
          lastValueRef.current = value;
          editorContentRef.current = value;
          return;
        }
      } catch (e) {
        // Cross-origin or other error, continue
      }
      
      // Only update if value is different from what we last sent
      // Use requestAnimationFrame to ensure this happens after any pending updates
      requestAnimationFrame(() => {
        if (iframeRef.current?.contentWindow && !isInternalChangeRef.current) {
          // Double-check flags before updating
          try {
            const iframeWindow = iframeRef.current.contentWindow as any;
            if (iframeWindow?._ckeditorInternalChange) {
              return;
            }
          } catch (e) {
            // Continue
          }
          
          lastValueRef.current = value;
          editorContentRef.current = value;
          iframeRef.current.contentWindow.postMessage({
            type: 'setContent',
            content: value
          }, '*');
        }
      });
    }
  }, [value]);

  // Mobile/Non-web: WebView approach
  useEffect(() => {
    if (Platform.OS !== 'web' && webViewRef.current && value !== undefined) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'setContent',
          content: value
        })
      );
    }
  }, [value]);

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'contentChange') {
        const newContent = message.data;
        // Only update if content actually changed
        if (newContent !== editorContentRef.current) {
          // Set flag BEFORE calling onChange to prevent immediate feedback
          isInternalChangeRef.current = true;
          lastValueRef.current = newContent;
          editorContentRef.current = newContent;
          
          // Use setTimeout to defer onChange, allowing React to process the flag first
          setTimeout(() => {
            onChange(newContent);
            // Keep flag set longer to prevent feedback loop
            setTimeout(() => {
              isInternalChangeRef.current = false;
            }, 1000); // Increased to 1 second to be safe
          }, 0);
        }
      } else if (message.type === 'error') {
        console.error('CKEditor error:', message.error);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  if (Platform.OS === 'web') {
    // For web, use iframe with proper React Native Web compatibility
    return (
      <View style={[styles.container, style]}>
        {typeof document !== 'undefined' && (
          // @ts-ignore - iframe is valid in React Native Web
          <iframe
            ref={(el: HTMLIFrameElement | null) => {
              if (el) iframeRef.current = el;
            }}
            srcDoc={editorHTML}
            style={{
              width: '100%',
              minHeight: 400,
              border: 'none',
              borderRadius: 6,
            }}
            sandbox="allow-same-origin allow-scripts allow-forms"
            title="CKEditor"
          />
        )}
      </View>
    );
  }

  // For mobile platforms, use WebView
  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: editorHTML }}
        onMessage={handleMessage}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
