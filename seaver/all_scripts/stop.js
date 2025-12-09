if (typeof engines !== "undefined" && engines.stopAll) {
  if (typeof engines.stopAllAndToast === "function") {
    engines.stopAllAndToast();
  } else {
    engines.stopAll();
  }
}
console.hide();
