import React from 'react'

type NextImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string
  alt: string
}

export default function Image({ src, alt, ...props }: NextImageProps) {
  return <img src={src} alt={alt} {...props} />
}
