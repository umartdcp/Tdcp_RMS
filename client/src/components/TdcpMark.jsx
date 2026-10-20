export default function TdcpMark({ size = 72, className = "" }) {
  return (
    <img
      src="/tdcp-logo.png?v=4"
      alt="The Tourism Development Corporation of Punjab"
      width={size}
      height={size}
      className={`shrink-0 bg-white object-contain ${className}`}
    />
  );
}
