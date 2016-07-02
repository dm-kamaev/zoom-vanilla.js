+function () { "use strict";
	var OFFSET = 80

	// From http://www.quirksmode.org/js/findpos.html
	function offset(element) {
		var offset = {
			top: 0,
			left: 0
		}

		if (!element.offsetParent) return offset

		do {
			offset.left += element.offsetLeft
			offset.top += element.offsetTop
		} while (element = element.offsetParent)

		return offset
	}

	function zoomListener() {
		var activeZoom = null
		var initialScrollPosition = null
		var initialTouchPosition = null

		function listen() {
			document.body.addEventListener('click', function (event) {
				if (event.target.getAttribute('data-action') === 'zoom') zoom(event)
			})
		}

		function zoom(event) {
			event.stopPropagation()

			var target = event.target

			if (!target || target.tagName != 'IMG') return

			if (document.body.classList.contains('zoom-overlay-open')) return

			if (event.metaKey || event.ctrlKey) {
				return window.open((event.target.getAttribute('data-original') || event.target.currentSrc || event.target.src), '_blank')
			}

			if (target.width >= (window.innerWidth - OFFSET)) return

			closeActiveZoom({ forceDispose: true })

			activeZoom = vanillaZoom(target)
			activeZoom.zoomImage()

			// todo(fat): probably worth throttling this
			window.addEventListener('scroll', handleScroll)
			document.addEventListener('click', handleClick)
			document.addEventListener('keyup', handleEscPressed)
			document.addEventListener('touchstart', handleTouchStart)
		}

		function closeActiveZoom({ forceDispose = false } = {}) {
			if (!activeZoom) return

			activeZoom[forceDispose ? 'dispose' : 'close']()

			window.removeEventListener('scroll', handleScroll)
			document.removeEventListener('keyup', handleEscPressed)
			document.removeEventListener('click', handleClick)
			document.removeEventListener('touchstart', handleTouchStart)

			activeZoom = null
		}

		function handleScroll(event) {
			if (initialScrollPosition === null) initialScrollPosition = window.scrollY
			var deltaY = initialScrollPosition - window.scrollY
			if (Math.abs(deltaY) >= 40) closeActiveZoom()
		}

		function handleEscPressed(event) {
			if (event.keyCode == 27) closeActiveZoom()
		}

		function handleClick(event) {
			event.stopPropagation()
			event.preventDefault()
			closeActiveZoom()
		}

		function handleTouchStart(event) {
			initialTouchPosition = event.touches[0].pageY
			event.target.addEventListener('touchmove', handleTouchMove)
		}

		function handleTouchMove(event) {
			if (Math.abs(event.touches[0].pageY - initialTouchPosition) <= 10) return
			closeActiveZoom()
			event.target.removeEventListener('touchmove', handleTouchMove)
		}

		return { listen }
	}

	function vanillaZoom(image) {
		var fullHeight = null
		var fullWidth = null
		var overlay = null
		var imgScaleFactor = null
		var translateX = null
		var translateY = null

		var targetImageWrap = null
		var targetImageClone = null
		var targetImage = image

		var _MAX_WIDTH = 2560
		var _MAX_HEIGHT = 4096

		function zoomImage() {
			var img = document.createElement('img')
			img.onload = function () {
				fullHeight = Number(img.height)
				fullWidth = Number(img.width)
				zoomOriginal()
			}
			img.src = targetImage.currentSrc || targetImage.src
		}

		function zoomOriginal() {
			targetImageWrap = document.createElement('div')
			targetImageWrap.className = 'zoom-img-wrap'
			targetImageWrap.style.position = 'absolute'
			targetImageWrap.style.top = offset(targetImage).top + 'px'
			targetImageWrap.style.left = offset(targetImage).left + 'px'

			targetImageClone = targetImage.cloneNode()
			targetImageClone.style.visibility = 'hidden'

			targetImage.style.width = targetImage.offsetWidth + 'px'
			targetImage.parentNode.replaceChild(targetImageClone, targetImage)

			document.body.appendChild(targetImageWrap)
			targetImageWrap.appendChild(targetImage)

			targetImage.classList.add('zoom-img')
			targetImage.setAttribute('data-action', 'zoom-out')

			overlay = document.createElement('div')
			overlay.className = 'zoom-overlay'

			document.body.appendChild(overlay)

			calculateZoom()
			triggerAnimation()
		}

		function calculateZoom() {
			targetImage.offsetWidth // repaint before animating

			var originalFullImageWidth  = fullWidth
			var originalFullImageHeight = fullHeight

			var scrollTop = window.scrollY

			var maxScaleFactor = originalFullImageWidth / targetImage.width

			var viewportHeight = window.innerHeight - OFFSET
			var viewportWidth  = window.innerWidth - OFFSET

			var imageAspectRatio    = originalFullImageWidth / originalFullImageHeight
			var viewportAspectRatio = viewportWidth / viewportHeight

			if (originalFullImageWidth < viewportWidth && originalFullImageHeight < viewportHeight) {
				imgScaleFactor = maxScaleFactor
			} else if (imageAspectRatio < viewportAspectRatio) {
				imgScaleFactor = (viewportHeight / originalFullImageHeight) * maxScaleFactor
			} else {
				imgScaleFactor = (viewportWidth / originalFullImageWidth) * maxScaleFactor
			}
		}

		function triggerAnimation() {
			targetImage.offsetWidth // repaint before animating

			var imageOffset = offset(targetImage)
			var scrollTop   = window.scrollY

			var viewportY = scrollTop + (window.innerHeight / 2)
			var viewportX = (window.innerWidth / 2)

			var imageCenterY = imageOffset.top + (targetImage.height / 2)
			var imageCenterX = imageOffset.left + (targetImage.width / 2)

			translateY = viewportY - imageCenterY
			translateX = viewportX - imageCenterX

			targetImage.style.webkitTransform = 'scale(' + imgScaleFactor + ')'
			targetImageWrap.style.webkitTransform = 'translate(' + translateX + 'px, ' + translateY + 'px) translateZ(0)'
			targetImage.style.msTransform = 'scale(' + imgScaleFactor + ')'
			targetImageWrap.style.msTransform = 'translate(' + translateX + 'px, ' + translateY + 'px) translateZ(0)'
			targetImage.style.transform = 'scale(' + imgScaleFactor + ')'
			targetImageWrap.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) translateZ(0)'

			document.body.classList.add('zoom-overlay-open')
		}

		function close() {
			document.body.classList.remove('zoom-overlay-open')
			document.body.classList.add('zoom-overlay-transitioning')

			targetImage.style.webkitTransform = ''
			targetImageWrap.style.webkitTransform = ''
			targetImage.style.msTransform = ''
			targetImageWrap.style.msTransform = ''
			targetImage.style.transform = ''
			targetImageWrap.style.transform = ''

			if (!'transition' in document.body.style) return dispose()

			targetImage.addEventListener('transitionend', dispose)
			targetImage.addEventListener('webkitTransitionEnd', dispose)
		}

		function dispose() {
			targetImage.removeEventListener('transitionend', dispose)
			targetImage.removeEventListener('webkitTransitionEnd', dispose)

			if (!targetImageWrap || !targetImageWrap.parentNode) return

			targetImage.classList.remove('zoom-img')
			targetImage.setAttribute('data-action', 'zoom')

			targetImageClone.parentNode.replaceChild(targetImage, targetImageClone)
			targetImageWrap.parentNode.removeChild(targetImageWrap)
			overlay.parentNode.removeChild(overlay)

			document.body.classList.remove('zoom-overlay-transitioning')
		}

		return { zoomImage, close, dispose }
	}

	zoomListener().listen()
}()
