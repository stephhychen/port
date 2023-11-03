var pyScript;function runCycle(e){console.log("[ProcessingWorker] runCycle "+JSON.stringify(e));try{scriptEvent=pyScript.send(e),self.postMessage({eventType:"runCycleDone",scriptEvent:scriptEvent.toJs({create_proxies:!1,dict_converter:Object.fromEntries})})}catch(n){self.postMessage({eventType:"runCycleDone",scriptEvent:generateErrorMessage(n.toString())})}}function unwrap(e){return console.log("[ProcessingWorker] unwrap response: "+JSON.stringify(e.payload)),new Promise((function(n){if("PayloadFile"===e.payload.__type__)copyFileToPyFS(e.payload.value,n);else n(e.payload)}))}function copyFileToPyFS(e,n){var o=e.stream().getReader(),r=self.pyodide.FS.open(e.name,"w");o.read().then((function t(i){var s=i.done,a=i.value;s?n({__type__:"PayloadString",value:e.name}):(self.pyodide.FS.write(r,a,0,a.length),o.read().then(t))}))}function initialise(){return console.log("[ProcessingWorker] initialise"),startPyodide().then((function(e){return self.pyodide=e,loadPackages()})).then((function(){return installPortPackage()}))}function startPyodide(){return importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.0/full/pyodide.js"),console.log("[ProcessingWorker] loading Pyodide"),loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.24.0/full/"})}function loadPackages(){return console.log("[ProcessingWorker] loading packages"),self.pyodide.loadPackage(["micropip","numpy","pandas"])}function installPortPackage(){return console.log("[ProcessingWorker] load port package"),self.pyodide.runPythonAsync('\n    import micropip\n    await micropip.install("../../port-0.0.0-py3-none-any.whl", deps=False)\n    import port\n  ')}function generateErrorMessage(e){return{__type__:"CommandUIRender",page:{__type__:"PropsUIPageError",stacktrace:e}}}onmessage=function(e){var n=e.data.eventType;switch(n){case"initialise":initialise().then((function(){self.postMessage({eventType:"initialiseDone"})}));break;case"firstRunCycle":pyScript=self.pyodide.runPython("port.start(".concat(e.data.sessionId,")")),runCycle(null);break;case"nextRunCycle":unwrap(e.data.response).then((function(e){runCycle(e)}));break;default:console.log("[ProcessingWorker] Received unsupported event: ",n)}};