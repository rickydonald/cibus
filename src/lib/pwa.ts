export type IosSplashScreen = {
	href: string;
	media: string;
	width: number;
	height: number;
};

function splashScreen(
	deviceWidth: number,
	deviceHeight: number,
	pixelRatio: 1 | 2 | 3,
): IosSplashScreen {
	const width = deviceWidth * pixelRatio;
	const height = deviceHeight * pixelRatio;

	return {
		href: `/splash/launch-${width}x${height}.png`,
		media: `(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`,
		width,
		height,
	};
}

// iOS uses exact viewport and pixel-ratio matches for startup images. Shared
// resolutions cover iPhone Duo, the current iPhone 18/17/16 families, and
// older devices.
export const iosSplashScreens = [
	splashScreen(626, 890, 3),
	splashScreen(466, 678, 3),
	splashScreen(440, 956, 3),
	splashScreen(420, 912, 3),
	splashScreen(430, 932, 3),
	splashScreen(428, 926, 3),
	splashScreen(414, 896, 3),
	splashScreen(414, 896, 2),
	splashScreen(402, 874, 3),
	splashScreen(393, 852, 3),
	splashScreen(390, 844, 3),
	splashScreen(375, 812, 3),
	splashScreen(360, 780, 3),
	splashScreen(414, 736, 3),
	splashScreen(375, 667, 2),
	splashScreen(320, 568, 2),
	splashScreen(320, 480, 2),
	splashScreen(320, 480, 1),
] as const;
