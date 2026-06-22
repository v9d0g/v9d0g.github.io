import { QuartzTransformerPlugin } from "../types"
import { Root } from "hast"
import { visit } from "unist-util-visit"

export const ClickableImages: QuartzTransformerPlugin = () => {
  return {
    name: "ClickableImages",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, _file: any) => {
            visit(tree, "element", (node: any, index, parent) => {
              if (node.tagName === "img" && parent && index !== undefined) {
                const originalSrc = node.properties?.src
                const originalAlt = node.properties?.alt || ""
                if (!originalSrc) return

                node.properties.className = (node.properties.className || []).concat([
                  "lightbox-image",
                ])
                node.properties["data-src"] = originalSrc
                node.properties["data-alt"] = originalAlt
                node.properties.loading = "lazy"

                const wrapper = {
                  type: "element",
                  tagName: "div",
                  properties: {
                    className: ["lightbox-wrapper"],
                    "data-lightbox": "true",
                  },
                  children: [node],
                }

                parent.children[index] = wrapper
              }
            })
          }
        },
      ]
    },
    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: `
/* Lightbox Image Styles */
.lightbox-wrapper {
  display: block;
  width: 100%;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s ease;
  margin: 1em 0;
}

.lightbox-wrapper:hover {
  transform: scale(1.02);
}

.lightbox-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

.lightbox-image:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

/* Modal/Lightbox Overlay */
.lightbox-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  backdrop-filter: blur(5px);
}

.lightbox-modal.active {
  opacity: 1;
  visibility: visible;
}

.lightbox-modal img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  transform: scale(0.8);
  transition: transform 0.1s ease-out;
  cursor: grab;
  user-select: none;
}

.lightbox-modal.active img {
  transform: scale(1);
}

.lightbox-close {
  position: absolute;
  top: 20px;
  right: 30px;
  font-size: 2rem;
  color: white;
  cursor: pointer;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.lightbox-close:hover {
  background: rgba(0, 0, 0, 0.8);
}

body.lightbox-open {
  overflow: hidden;
}

@media (max-width: 768px) {
  .lightbox-modal img {
    max-width: 95%;
    max-height: 95%;
  }

  .lightbox-close {
    top: 10px;
    right: 15px;
    font-size: 1.5rem;
    width: 35px;
    height: 35px;
  }
}
            `,
          },
        ],
        js: [
          {
            loadTime: "afterDOMReady",
            contentType: "inline",
            script: `
              function initLightbox() {
                const existingModal = document.querySelector('.lightbox-modal');
                if (existingModal) existingModal.remove();

                const modal = document.createElement('div');
                modal.className = 'lightbox-modal';
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'lightbox-close';
                closeBtn.innerHTML = '×';
                closeBtn.setAttribute('aria-label', 'Close lightbox');
                
                const img = document.createElement('img');
                img.style.display = 'none';
                
                modal.appendChild(closeBtn);
                modal.appendChild(img);
                document.body.appendChild(modal);

                let scale = 1;
                let isDragging = false;
                let startX = 0, startY = 0, currentX = 0, currentY = 0;

                function resetTransform() {
                  scale = 1;
                  currentX = currentY = 0;
                  img.style.transform = 'scale(1) translate(0px, 0px)';
                }

                // Zoom with wheel
                img.addEventListener('wheel', (e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.1 : 0.1;
                  scale = Math.min(Math.max(scale + delta, 1), 5);
                  img.style.transform = \`scale(\${scale}) translate(\${currentX}px, \${currentY}px)\`;
                });

                // Drag to move (with robust release handling)
                img.addEventListener('mousedown', (e) => {
                  if (scale <= 1) return;
                  isDragging = true;
                  startX = e.clientX - currentX;
                  startY = e.clientY - currentY;
                  img.style.cursor = 'grabbing';
                  e.preventDefault();
                });

                document.addEventListener('mousemove', (e) => {
                  if (!isDragging) return;
                  currentX = e.clientX - startX;
                  currentY = e.clientY - startY;
                  img.style.transform = \`scale(\${scale}) translate(\${currentX}px, \${currentY}px)\`;
                });

                document.addEventListener('mouseup', () => {
                  if (isDragging) {
                    isDragging = false;
                    img.style.cursor = 'grab';
                  }
                });

                img.addEventListener('mouseleave', () => {
                  if (isDragging) {
                    isDragging = false;
                    img.style.cursor = 'grab';
                  }
                });

                // Double click to reset
                img.addEventListener('dblclick', resetTransform);

                function openLightbox(imageSrc, imageAlt, originalImg) {
                  img.src = imageSrc;
                  img.alt = imageAlt || '';
                  img.style.display = 'block';
                  modal.classList.add('active');
                  document.body.classList.add('lightbox-open');
                  resetTransform();
                }

                function closeLightbox() {
                  modal.classList.remove('active');
                  document.body.classList.remove('lightbox-open');
                  setTimeout(() => {
                    img.style.display = 'none';
                    img.src = '';
                  }, 300);
                }

                closeBtn.addEventListener('click', closeLightbox);
                modal.addEventListener('click', (e) => {
                  if (e.target === modal) closeLightbox();
                });
                document.addEventListener('keydown', (e) => {
                  if (e.key === 'Escape' && modal.classList.contains('active')) closeLightbox();
                });

                const wrappers = document.querySelectorAll('.lightbox-wrapper');
                wrappers.forEach(wrapper => {
                  wrapper.addEventListener('click', (e) => {
                    e.preventDefault();
                    const imgEl = wrapper.querySelector('.lightbox-image');
                    if (imgEl) {
                      const src = imgEl.getAttribute('data-src') || imgEl.src;
                      const alt = imgEl.getAttribute('data-alt') || imgEl.alt;
                      openLightbox(src, alt, imgEl);
                    }
                  });
                });

                if (window.addCleanup) {
                  window.addCleanup(() => {
                    if (modal.parentNode) modal.parentNode.removeChild(modal);
                    document.body.classList.remove('lightbox-open');
                  });
                }
              }

              document.addEventListener('nav', initLightbox);
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initLightbox);
              } else {
                initLightbox();
              }
            `,
          },
        ],
      }
    },
  }
}
