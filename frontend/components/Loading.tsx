export default function Loading({ label = 'Loading...', fullscreen = false }: { label?: string; fullscreen?: boolean }) {
	return (
		<div
			className={
				(fullscreen
					? 'fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex'
					: 'min-h-[200px]') +
				' items-center justify-center'
			}
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<div className="flex flex-col items-center gap-4 p-6 rounded-xl">
				{/* Barcode */}
				<div className="relative h-10 sm:h-12 w-48 sm:w-56 overflow-hidden">
					<div className="absolute inset-0 flex items-end justify-between">
						{Array.from({ length: 20 }).map((_, i) => (
							<span
								key={i}
								className="bg-gray-800/80 dark:bg-gray-200/90 rounded-sm"
								style={{
									display: 'inline-block',
									width: i % 3 === 0 ? 6 : i % 2 === 0 ? 3 : 2,
									height: (28 + ((i * 7) % 14)) + 'px',
									animation: `barcodePulse 1.2s ease-in-out ${i * 0.05}s infinite`,
								}}
							/>
						))}
					</div>
				</div>

				{/* Label */}
				<div className="flex items-center gap-2 text-sm text-gray-700">
					<span className="sr-only">Loading</span>
					<span aria-hidden className="font-medium tracking-wide text-gray-700">{label}</span>
				</div>
			</div>

			<style jsx>{`
				@keyframes barcodePulse {
					0% { transform: translateY(0) scaleY(0.85); opacity: .6; }
					50% { transform: translateY(-4px) scaleY(1); opacity: 1; }
					100% { transform: translateY(0) scaleY(0.85); opacity: .6; }
				}

				@media (prefers-reduced-motion: reduce) {
					span { animation: none !important; }
				}
			`}</style>
		</div>
	)
}


