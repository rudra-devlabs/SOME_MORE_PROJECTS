binary = int(input("Enter a number: "))
dec = 0
p = 0
while binary > 0:
    toMult = 2**p
    dig = binary % 10
    binary //= 10
    if (dig == 1):
        dec += toMult
    p+=1
print(f"{binary} ---> {dec}")
        