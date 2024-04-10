/**
 * Convert HTML text elements
 * to svg text
 */

function html2SvgText(htmlEl, textNodes = null) {
  // get all text nodes in element: either passed by argument or retrieved from element
  textNodes = textNodes === null ? getTextNodesInEL(htmlEl) : textNodes;
  const removeWhiteSpace = (textNode) => {
    // remove new lines, tabs and leading/trailing space
    textNode.nodeValue =
      textNode.nodeValue
        .replace(/[\n\r\t]/g, " ")
        //.replace(/[\t]/g, " ")
        .replace(/\ {2,}/g, " ")
        .trim() + " ";
    return textNode;
  };

  // parent boundaries to get global x/y offsets for svg elements
  let bb = htmlEl.getBoundingClientRect();

  // here we'll store all our lines
  let textNodeObj = {
    xOffset: bb.x,
    yOffset: bb.y,
    width: bb.width,
    height: bb.height,
    textNodeData: [],
    // define style props for rendering
    styleProps: {
      fontFamily: [],
      fontSize: [16],
      fontWeight: ["400", "normal"],
      fontStyle: ["normal"],
      fontStretch: ["100%"],
      color: ["rgb(0, 0, 0)"],
      letterSpacing: ["normal"],
      textDecoration: ["none", "none solid rgb(0, 0, 0)"],
      textTransform: ["none"]
    }
  };

  /**
   * get boundaries of text nodes
   */
  textNodes.forEach((textNode, i) => {
    removeWhiteSpace(textNode);
    let parent = textNode.parentElement;
    // set parent element id to identify element shifts
    parent.dataset.id = parent.nodeName.toLowerCase() + "_" + i;
    getTextNodeBboxes(textNode, textNodeObj);
  });

  /**
   * translate values to svg baseline offsets
   */
  let { xOffset, yOffset } = textNodeObj;

  //count lines
  let lineNum = 1;
  textNodeObj.textNodeData.forEach((line, i) => {
    // approximated descender height: height from bbox top to text baseline
    let baseLineShift = line.style.fontSize * 0.25;
    line.x = line.x - xOffset;
    line.y = line.y - yOffset + line.height - baseLineShift;
    let linePrev =
      i > 0 ? textNodeObj.textNodeData[i - 1] : textNodeObj.textNodeData[i];
    if (line.y > linePrev.y) {
      lineNum++;
    }
    // add line num
    line.lineNum = lineNum;
  });

  // render svg
  let svgEl = renderSVGText(textNodeObj);
  //console.log(textNodeObj);
  return svgEl;
}

function getTextNodeBboxes(node, textNodeObj) {
  let lastYTop, lastLeft;
  let parentElement = node.parentElement;
  let parentId = parentElement.dataset.id;
  let parentType = parentId.split("_")[0];

  // weird fix for Firefox - dunno why
  parentElement.style.display = "inline-block";
  parentElement.getBoundingClientRect();
  parentElement.style.removeProperty("display");

  let words = node.nodeValue.split(" ").filter(Boolean);

  // get style from parent element
  let style = window.getComputedStyle(node.parentElement);
  let { styleProps } = textNodeObj;
  let textNodeDatatyle = {};
  for (propName in styleProps) {
    let propValue =
      propName === "fontSize" ? parseFloat(style["fontSize"]) : style[propName];
    textNodeDatatyle[propName] = propValue;
  }

  // initial position - get line height
  let range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 1);

  // bbox from first character: single line height
  let bb_start = range.getBoundingClientRect();
  let word = node.textContent;

  // has line break? check end of node bbox
  range.setStart(node, 0);
  range.setEnd(node, node.length - 1);
  let bb_end = range.getBoundingClientRect();

  // base line height
  let lineHeight = bb_start.height;
  let isMultiline = bb_end.height > bb_start.height;

  // ignore empty strings e.g new lines
  let isNewLine = /[\n|\r]/g.test(word);
  //let newLineChar = isNewLine ? '\n' :''

  let empty = word.trim() === "";
  if (empty && !isNewLine) {
    return false;
  }

  // single line – no hyphenations
  if (!isMultiline) {
    textNodeObj.textNodeData.push({
      text: word,
      x: bb_start.left,
      y: bb_start.top,
      height: bb_end.height,
      style: textNodeDatatyle,
      hyphenated: false,
      parentId: parentId,
      href: parentType === "a" ? parentElement.getAttribute("href") : ""
    });
  }

  // multine: refine search on word layer
  else {
    // loop words
    let start = 0,
      end = 1;

    for (let i = 0; i < words.length; i++) {
      word = words[i];
      end = start + word.length;

      // get range bbox
      range.setStart(node, start);
      range.setEnd(node, end);
      let rangeBB = range.getBoundingClientRect();

      // has linebreak? split textNodeData
      let hasLinebreak = rangeBB.height > lineHeight;

      // no line breaks = no hyphenation => concatenate
      if (!hasLinebreak) {
        let textNodeData = textNodeObj.textNodeData;
        let prev = textNodeData.length
          ? textNodeData[textNodeData.length - 1]
          : textNodeData[0];

        // no line break – concatenate text
        if (i > 0 && rangeBB.top === prev.y) {
          textNodeObj.textNodeData[textNodeData.length - 1].text += word + " ";
        }
        // add new item
        else {
          textNodeObj.textNodeData.push({
            text: word + " ",
            x: rangeBB.x,
            y: rangeBB.top,
            height: rangeBB.height,
            style: textNodeDatatyle,
            parentId: parentId,
            hyphenated: false,
            href: parentType === "a" ? parentElement.getAttribute("href") : ""
          });
        }
      }

      // has line breaks: my contain hyphenations
      else {
        let startChar = end - word.length + 1;
        let endChar = startChar + 1;
        lastYTop = rangeBB.top;
        lastLeft = rangeBB.left;
        let splitIndices = [0];

        // loop characters
        let chars = word.split("").filter(Boolean);
        let hyphenated = true;
        let has_hyphenChar = /[-|–]/g.test(word); // hyphen or endash

        for (let c = 0; c < chars.length - 1; c++) {
          endChar = startChar;
          range.setStart(node, startChar);
          range.setEnd(node, endChar);
          rangeBB = range.getBoundingClientRect();

          // check empty trailing characters
          let char = chars[c];
          let is_empty = char.trim() !== char;

          // is hyphenated
          if ((rangeBB.top > lastYTop || rangeBB.top < lastYTop) && !is_empty) {
            let prevIndex = splitIndices[splitIndices.length - 1];
            let sub = word.substr(prevIndex, c - prevIndex);

            // sub word bbox
            range.setStart(node, start);
            range.setEnd(node, start + sub.length);
            let rangeBB2 = range.getBoundingClientRect();

            textNodeObj.textNodeData.push({
              // remove soft hyphens
              text: sub.replace(/\u00AD/g, ""),
              x: rangeBB2.left,
              y: rangeBB2.top,
              height: rangeBB2.height,
              style: textNodeDatatyle,
              parentId: parentId,
              hyphenated: has_hyphenChar ? false : hyphenated,
              href: parentType === "a" ? parentElement.getAttribute("href") : ""
            });
            splitIndices.push(c);
            lastYTop = rangeBB2.top;
          }

          lastLeft = lastLeft;
          lastYTop = rangeBB.top;
          startChar += 1;
        }

        //last
        textNodeObj.textNodeData.push({
          // append space
          text:
            word.substr(splitIndices[splitIndices.length - 1], word.length) +
            " ",
          x: lastLeft,
          y: lastYTop,
          height: rangeBB.height,
          style: textNodeDatatyle,
          parentId: parentId,
          hyphenated: false,
          href: parentType === "a" ? parentElement.getAttribute("href") : ""
        });
      }
      //update char pos
      start = end + 1;
    }
  }
}


// text helpers
function getTextNodesInEL(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}
