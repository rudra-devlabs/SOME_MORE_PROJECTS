num = int(input("Enter a number: "))
s = 0 #SUM
while num != 0:
    rem = num%10
    num //= 10
    s += rem
    
print(f"Sum: {s}")