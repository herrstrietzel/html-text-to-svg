
/**
 * render svg text and textNodeData
 */
function renderSVGText(textNodeObj, decimals = 1) {
  //needed to adjust coordinates
  let { width, height, styleProps, textNodeData } = textNodeObj;
  [width, height] = [width, height].map((val) => {
    return Math.ceil(val);
  });
  let item0 = textNodeData[0];
  let lastTspanY = item0.y;
  let lastStyle = item0.style;

  // create svg elements
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", [0, 0, width, height].join(" "));
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  // wrap in group
  const gText = document.createElementNS(ns, "g");
  gText.classList.add("gText");
  svg.append(gText);

  // create svg text element to emulate HTML paragraph
  let svgText = document.createElementNS(ns, "text");
  svgText.textContent = "";

  svgText.setAttribute(
    "style",
    `font-family:${item0.style.fontFamily}; font-size:${item0.style.fontSize}px; font-weight:${item0.style.fontWeight};`
  );

  svgText.setAttribute("x", item0.x);
  svgText.setAttribute("y", item0.y);
  gText.append(svgText);

  let tspan = document.createElementNS(ns, "tspan");
  svgText.append(tspan);

  let baseStyle = {
    fontFamily: item0.style.fontFamily,
    fontStyle: "normal",
    fontWeight: 400,
    fontSize: item0.style.fontSize
  };
  let baseStyleStr = Object.values(baseStyle).join("");

  textNodeData.forEach((item, i) => {
    let prev = i > 0 ? textNodeData[i - 1] : textNodeData[i];
    let next =
      i < textNodeData.length - 2
        ? textNodeData[i + 1]
        : textNodeData[textNodeData.length - 1];
    let styleStr = Object.values(item.style).join("");
    let styleStrPrev = Object.values(lastStyle).join("");
    let tspanNew = document.createElementNS(ns, "tspan");
    let colBreak = prev.y > item.y;

    // we need to adjust y values to match the baseline
    fontSize = item.style.fontSize;
    svgBaselineY = item.y;

    //not same line create new tspan
    let sameStyle = styleStr === styleStrPrev;
    let sameY = svgBaselineY === lastTspanY;

    // add links
    if (item.parent === "a") {
      // add link and new text el
      let link = document.createElementNS(ns, "a");
      link.setAttribute("href", item.href);
      svgText = document.createElementNS(ns, "text");
      tspanNew = document.createElementNS(ns, "tspan");
      tspanNew.textContent = item.text;
      svgText.setAttribute(
        "style",
        `font-family: ${baseStyle.fontFamily}; font-size: ${baseStyle.fontSize}px; font-weight: ${baseStyle.fontWeight};`
      );

      //let dy = +(item.y - prev.y).toFixed(1)
      tspanNew.setAttribute("x", +item.x.toFixed(decimals));
      tspanNew.setAttribute("y", item.y);
      tspanNew.classList.add("tspan-a");

      // append link
      gText.append(link);
      svgText.append(tspanNew);
      link.append(svgText);

      if (next.parent !== "a") {
        // next text el after link
        svgText = document.createElementNS(ns, "text");
        svgText.classList.add("p-a");
        svgText.setAttribute(
          "style",
          `font-family: ${baseStyle.fontFamily}; font-size: ${baseStyle.fontSize}px; font-weight: ${baseStyle.fontWeight};`
        );

        svgText.setAttribute("x", item.x);
        svgText.setAttribute("y", item.y);
        gText.append(svgText);
        tspan = tspanNew;
      }

      tspan = tspanNew;
    } else if ((i > 0 && !sameY && !item.hypenated) || !sameStyle) {
      tspanNew.textContent = item.text;
      let dy = +(item.y - prev.y).toFixed(decimals);

      // omit x/dy values if on same line and not after column shift
      if (prev.lineNum !== item.lineNum || prev.parent === "a" || colBreak) {
        tspanNew.setAttribute("x", +item.x.toFixed(decimals));
      }
      if (dy) {
        tspanNew.setAttribute("dy", dy);
      }
      svgText.append(tspanNew);
      tspan = tspanNew;
    }
    // same line/style – append content to previous tspan
    else {
      tspan.textContent += item.text;
    }

    // append hyphen tspan
    let tspanHyphen;
    if (item.hyphenated) {
      tspanHyphen = document.createElementNS(ns, "tspan");
      tspanHyphen.classList.add("tspanHyphen");
      tspanHyphen.setAttribute("aria-hidden", "true");
      tspanHyphen.style.userSelect = "none";
      tspanHyphen.textContent = "-";
      svgText.append(tspanHyphen);
    }

    // apply styles if different from base style or previous
    if (baseStyleStr !== styleStr || styleStrPrev !== styleStr) {
      for (propName in styleProps) {
        let propValue = item.style[propName];
        propValue = propName === "fontSize" ? parseFloat(propValue) : propValue;
        let propDefaults = styleProps[propName];
        let unit = propName === "fontSize" ? "px" : "";
        propName = propName === "color" ? "fill" : propName;

        //set styles - ignore defaults
        if (
          propDefaults.length &&
          !propDefaults.includes(propValue) &&
          propValue.toString().indexOf("none") === -1 &&
          propValue !== baseStyle[propName]
        ) {
          tspan.style[propName] = propValue + unit;

          if (item.hyphenated) {
            tspanHyphen.style[propName] = propValue + unit;
          }
        }
      }
    }

    // update y
    lastTspanY = item.y;
    lastStyle = item.style;
  });

  return svg;
}
